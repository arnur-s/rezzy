// send-message-push
//
// Delivers Web Push (desktop/OS) notifications for the recipients of a single
// inbound message. Recipients are resolved server-side by the
// public.create_message_notifications trigger; this function only fans out push
// delivery to those recipients whose desktop notifications are enabled,
// honoring each recipient's message preview privacy mode.
//
// Invoked server-to-server by the channel webhooks after an inbound message is
// inserted. Authenticated by the service-role key (verify_jwt = false). Never
// throws back to the caller in a way that would break message ingestion.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' }

type PreviewMode = 'full' | 'sender_only' | 'hidden'

const GENERIC_TITLE = 'New message'
const PREVIEW_MAX_LENGTH = 140

const MEDIA_LABELS: Record<string, string> = {
  image: 'Photo',
  video: 'Video',
  voice: 'Voice message',
  audio: 'Audio',
  document: 'Document',
  sticker: 'Sticker',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function buildPayload(
  previewMode: PreviewMode,
  contactName: string | null,
  message: { type: string; content: string | null },
): { title: string; body: string } {
  if (previewMode === 'hidden') {
    return { title: GENERIC_TITLE, body: '' }
  }

  const name = contactName?.trim() || GENERIC_TITLE

  if (previewMode === 'sender_only') {
    return { title: name, body: GENERIC_TITLE }
  }

  const content = (message.content ?? '').trim()
  let body: string
  if (content) {
    body =
      content.length > PREVIEW_MAX_LENGTH
        ? `${content.slice(0, PREVIEW_MAX_LENGTH).trimEnd()}…`
        : content
  } else {
    body = MEDIA_LABELS[message.type] ?? GENERIC_TITLE
  }
  return { title: name, body }
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: CORS_HEADERS })
    }
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    // A dedicated shared secret, not Supabase's reserved service-role key —
    // that reserved name/value can differ across Supabase's key-system
    // generations (legacy JWT-style vs newer sb_secret_ keys), which made a
    // direct comparison against it unreliable. This secret is set once and
    // controlled entirely by us on both the caller (webhooks) and this
    // function, so there's no ambiguity about which value is authoritative.
    const dispatchSecret = Deno.env.get('PUSH_DISPATCH_SECRET') ?? ''
    const token = (req.headers.get('Authorization') ?? '').replace(
      /^Bearer\s+/i,
      '',
    )
    if (!dispatchSecret || token !== dispatchSecret) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    // Fallback contact used only if the VAPID_SUBJECT secret isn't set.
    // Override with a support alias or the app's URL once one exists.
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:ncase01@gmail.com'
    if (!vapidPublic || !vapidPrivate) {
      // Push not configured — succeed as a no-op so ingestion is unaffected.
      return json({ delivered: 0, skipped: 'vapid_not_configured' }, 200)
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    let requestBody: { messageId?: string }
    try {
      requestBody = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }
    const messageId = requestBody.messageId
    if (!messageId || typeof messageId !== 'string') {
      return json({ error: 'messageId is required' }, 400)
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: notifications, error: notifError } = await supabase
      .from('message_notifications')
      .select('id, recipient_id, workspace_id, conversation_id')
      .eq('message_id', messageId)

    if (notifError) return json({ error: notifError.message }, 500)
    if (!notifications || notifications.length === 0) {
      return json({ delivered: 0 }, 200)
    }

    const first = notifications[0]

    const { data: message } = await supabase
      .from('messages')
      .select('id, type, content')
      .eq('id', messageId)
      .maybeSingle()
    if (!message) return json({ delivered: 0 }, 200)

    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, contact_id')
      .eq('id', first.conversation_id)
      .maybeSingle()

    let contactName: string | null = null
    if (conversation?.contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('name')
        .eq('id', conversation.contact_id)
        .maybeSingle()
      contactName = contact?.name ?? null
    }

    let delivered = 0

    for (const notification of notifications) {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('desktop_enabled, preview_mode')
        .eq('user_id', notification.recipient_id)
        .maybeSingle()

      if (!prefs || !prefs.desktop_enabled) continue

      const previewMode = (prefs.preview_mode ?? 'full') as PreviewMode
      const payload = buildPayload(previewMode, contactName, {
        type: message.type,
        content: message.content,
      })

      const pushBody = JSON.stringify({
        title: payload.title,
        body: payload.body,
        conversationId: notification.conversation_id,
        workspaceId: notification.workspace_id,
        notificationId: notification.id,
      })

      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', notification.recipient_id)

      for (const sub of subscriptions ?? []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            pushBody,
          )
          delivered += 1
          await supabase
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id)
        } catch (error) {
          const statusCode =
            error && typeof error === 'object' && 'statusCode' in error
              ? (error as { statusCode?: number }).statusCode
              : undefined
          // Endpoint gone/expired — remove the dead subscription.
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          } else {
            console.error('send-message-push: delivery failed', statusCode)
          }
        }
      }
    }

    return json({ delivered }, 200)
  },
}
