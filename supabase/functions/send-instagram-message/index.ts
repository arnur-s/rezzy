// send-instagram-message.ts
// Delivers an outbound Instagram Direct message via the Instagram Send API. On
// success the row keeps status `sent` (Meta only *accepted* it) with the
// returned message_id stored as external_id — read progression arrives later via
// the webhook's messaging_seen (read.mid) events. Auth failures surface a
// distinct "reconnect" error. Replies are only allowed within the 24h window.
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { insertStatusEvent, touchChannelActivity } from '../_shared/persist.ts'
import {
  instagramAttachmentType,
  isSendableMessageType,
  isWithinMessagingWindow,
  textExceedsLimit,
} from './lib.ts'

const GRAPH_VERSION = Deno.env.get('INSTAGRAM_GRAPH_VERSION') ?? 'v25.0'
const IG_GRAPH = `https://graph.instagram.com/${GRAPH_VERSION}`
const CHAT_MEDIA_BUCKET = 'chat-media'

// Meta error code for an expired/invalid access token.
const IG_AUTH_ERROR_CODE = 190

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  ...CORS_HEADERS,
}

interface SendBody {
  messageId?: string
}

interface MessageRow {
  id: string
  workspace_id: string
  conversation_id: string
  direction: string
  status: string | null
  content: string | null
  external_id: string | null
  type: string
  media_url: string | null
  media_filename: string | null
  media_mime_type: string | null
}

interface InstagramSendResponse {
  recipient_id?: string
  message_id?: string
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

type SecretField = 'access_token' | 'instagram_user_id'

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { headers: JSON_HEADERS, status })
}

function getCredentialString(credentials: unknown, field: SecretField): string {
  if (
    typeof credentials !== 'object' ||
    credentials === null ||
    Array.isArray(credentials)
  ) {
    return ''
  }
  const value = Object.entries(credentials).find(([key]) => key === field)?.[1]
  return typeof value === 'string' ? value.trim() : ''
}

function hasCredentialObject(credentials: unknown): boolean {
  return (
    typeof credentials === 'object' &&
    credentials !== null &&
    !Array.isArray(credentials)
  )
}

function logNetworkError(context: string, error: unknown): void {
  const detail = error instanceof Error ? error.name : typeof error
  console.error(`${context}: ${detail}`)
}

function sanitizedProviderString(value: unknown, maxLength = 200): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : null
}

function providerDiagnostics(
  responseStatus: number,
  error: InstagramSendResponse['error'],
): Record<string, unknown> {
  return {
    provider_http_status: responseStatus,
    code: typeof error?.code === 'number' ? error.code : null,
    error_subcode:
      typeof error?.error_subcode === 'number' ? error.error_subcode : null,
    type: sanitizedProviderString(error?.type, 100),
    trace_id: sanitizedProviderString(error?.fbtrace_id),
  }
}

function previewFromRow(row: MessageRow): string {
  const trimmed = row.content?.trim() ?? ''
  if (trimmed) return trimmed.length > 100 ? trimmed.slice(0, 100) : trimmed
  switch (row.type) {
    case 'image':
      return '📷 Photo'
    case 'video':
      return '🎥 Video'
    case 'audio':
    case 'voice':
      return '🎧 Audio'
    default:
      return ''
  }
}

/**
 * Marks the outbound message failed and persists safe provider diagnostics
 * into the status history (never tokens or message bodies).
 */
async function recordSendFailure(
  admin: SupabaseClient,
  row: { id: string; workspace_id: string },
  channelId: string | null,
  errorCode: string | null,
  errorType: string | null,
  traceId: string | null = null,
): Promise<void> {
  await admin.from('messages').update({ status: 'failed' }).eq('id', row.id)
  await insertStatusEvent(admin, {
    workspaceId: row.workspace_id,
    messageId: row.id,
    status: 'failed',
    errorCode,
    errorType,
    traceId,
  })
  if (channelId) {
    await touchChannelActivity(admin, channelId, 'error', errorCode)
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: CORS_HEADERS })
    }
    if (req.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: CORS_HEADERS,
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error('send-instagram-message: missing Supabase env')
      return jsonResponse(500, { error: 'Server misconfiguration' })
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return jsonResponse(401, { error: 'Not authenticated' })
    }

    let body: SendBody
    try {
      body = (await req.json()) as SendBody
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON body' })
    }
    const messageId =
      typeof body.messageId === 'string' ? body.messageId.trim() : ''
    if (!messageId) {
      return jsonResponse(400, { error: 'messageId is required' })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: message, error: msgError } = await admin
      .from('messages')
      .select(
        'id, workspace_id, conversation_id, direction, status, content, external_id, type, media_url, media_filename, media_mime_type',
      )
      .eq('id', messageId)
      .maybeSingle()
    if (msgError) {
      console.error('send-instagram-message: message load error', msgError)
      return jsonResponse(500, { error: 'Failed to load message' })
    }
    if (!message) {
      return jsonResponse(404, { error: 'Message not found' })
    }
    const row = message as MessageRow

    const { data: membership, error: memberError } = await admin
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', row.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (memberError) {
      console.error('send-instagram-message: membership lookup', memberError)
      return jsonResponse(500, { error: 'Failed to verify access' })
    }
    if (!membership) {
      return jsonResponse(403, { error: 'Not a member of this workspace' })
    }

    if (row.direction !== 'outbound') {
      return jsonResponse(400, { error: 'Message is not outbound' })
    }

    // Idempotency: if Meta already accepted this row it has an external_id.
    if (row.external_id) {
      return jsonResponse(200, {
        ok: true,
        message: { id: row.id, status: row.status, external_id: row.external_id },
      })
    }

    if (row.status !== 'sent') {
      return jsonResponse(400, {
        error: `Invalid message status: ${row.status ?? 'null'}`,
      })
    }

    // Only text/image/video/audio are sendable through Instagram.
    if (!isSendableMessageType(row.type)) {
      await recordSendFailure(admin, row, null, 'unsendable_type', null)
      return jsonResponse(400, {
        error: 'Instagram supports text, image, video and audio messages only.',
      })
    }

    if (row.type === 'text') {
      const content = row.content?.trim() ?? ''
      if (!content) {
        return jsonResponse(400, { error: 'Message has no content' })
      }
      if (textExceedsLimit(content)) {
        await recordSendFailure(admin, row, null, 'text_too_long', null)
        return jsonResponse(400, {
          error: 'Message is too long for Instagram (1000 bytes maximum).',
        })
      }
    }

    const { data: conversation, error: convError } = await admin
      .from('conversations')
      .select('contact_id, channel_id')
      .eq('id', row.conversation_id)
      .maybeSingle()
    if (convError || !conversation) {
      console.error('send-instagram-message: conversation load', convError)
      return jsonResponse(404, { error: 'Conversation not found' })
    }
    const channelId = conversation.channel_id as string
    const contactId = conversation.contact_id as string

    const { data: channel, error: channelError } = await admin
      .from('channels')
      .select('id, type, is_active')
      .eq('id', channelId)
      .maybeSingle()
    if (channelError || !channel) {
      console.error('send-instagram-message: channel load', channelError)
      return jsonResponse(404, { error: 'Channel not found' })
    }
    if (channel.type !== 'instagram') {
      return jsonResponse(400, { error: 'Channel is not Instagram' })
    }
    if (!channel.is_active) {
      await recordSendFailure(admin, row, channelId, 'channel_inactive', null)
      return jsonResponse(409, {
        error:
          'Channel is inactive. Activate it in settings before sending messages.',
      })
    }

    // Instagram forbids cold outbound: only reply inside the 24h window measured
    // from the customer's most recent inbound message.
    const { data: lastInbound, error: inboundError } = await admin
      .from('messages')
      .select('created_at')
      .eq('conversation_id', row.conversation_id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (inboundError) {
      console.error('send-instagram-message: inbound lookup', inboundError)
      return jsonResponse(500, { error: 'Failed to verify messaging window' })
    }
    if (!isWithinMessagingWindow(lastInbound?.created_at, Date.now())) {
      await recordSendFailure(admin, row, channelId, 'messaging_window_closed', null)
      return jsonResponse(403, {
        error:
          'You can only reply within 24 hours of the customer’s last Instagram message.',
      })
    }

    const { data: credentials, error: secretError } = await admin.rpc(
      'get_channel_credentials',
      { p_channel_id: channelId },
    )
    if (secretError) {
      console.error('send-instagram-message: channel secret load', secretError)
      return jsonResponse(500, { error: 'Failed to load channel secret' })
    }
    if (!hasCredentialObject(credentials)) {
      return jsonResponse(400, { error: 'Instagram channel secret missing' })
    }
    const accessToken = getCredentialString(credentials, 'access_token')
    const igUserId = getCredentialString(credentials, 'instagram_user_id')
    if (!accessToken || !igUserId) {
      return jsonResponse(400, {
        error: 'Instagram credentials missing in channel secret',
      })
    }

    // Recipient IGSID from the channel-scoped contact_channels row.
    const { data: contactChannel, error: ccError } = await admin
      .from('contact_channels')
      .select('external_id')
      .eq('contact_id', contactId)
      .eq('channel_id', channelId)
      .eq('channel_type', 'instagram')
      .maybeSingle()
    if (ccError) {
      console.error('send-instagram-message: contact_channel load', ccError)
      return jsonResponse(500, { error: 'Failed to load contact channel' })
    }
    const recipientId = contactChannel?.external_id?.trim() ?? ''
    if (!recipientId) {
      await recordSendFailure(admin, row, channelId, 'missing_recipient', null)
      return jsonResponse(400, {
        error: 'No Instagram recipient is available for this conversation.',
      })
    }

    // Build the message payload (text or a signed-URL attachment).
    const attachmentType = instagramAttachmentType(row.type)
    let messagePayload: Record<string, unknown>
    if (attachmentType && row.media_url) {
      const { data: signedData, error: signedError } = await admin.storage
        .from(CHAT_MEDIA_BUCKET)
        .createSignedUrl(row.media_url, 3600)
      if (signedError || !signedData?.signedUrl) {
        console.error('send-instagram-message: signed URL error', signedError)
        await recordSendFailure(admin, row, channelId, 'signed_url_failed', null)
        return jsonResponse(502, {
          error: 'Failed to create signed URL for media',
        })
      }
      messagePayload = {
        attachment: {
          type: attachmentType,
          payload: { url: signedData.signedUrl },
        },
      }
    } else {
      messagePayload = { text: row.content?.trim() ?? '' }
    }

    const requestBody = {
      recipient: { id: recipientId },
      message: messagePayload,
    }

    let igRes: Response
    try {
      igRes = await fetch(`${IG_GRAPH}/${igUserId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
    } catch (e) {
      logNetworkError('send-instagram-message: Instagram network error', e)
      await recordSendFailure(admin, row, channelId, 'network_error', null)
      return jsonResponse(502, { error: 'Instagram request failed' })
    }

    let igJson: InstagramSendResponse
    try {
      igJson = (await igRes.json()) as InstagramSendResponse
    } catch (e) {
      logNetworkError('send-instagram-message: invalid Instagram response', e)
      await recordSendFailure(admin, row, channelId, 'parse_error', null)
      return jsonResponse(502, {
        error: 'Instagram returned an invalid response',
      })
    }

    const providerMessageId = igJson.message_id
    if (!igRes.ok || !providerMessageId) {
      const diagnostics = providerDiagnostics(igRes.status, igJson.error)
      await recordSendFailure(
        admin,
        row,
        channelId,
        diagnostics.code != null ? String(diagnostics.code) : null,
        typeof diagnostics.type === 'string' ? diagnostics.type : null,
        typeof diagnostics.trace_id === 'string' ? diagnostics.trace_id : null,
      )
      console.error(
        'send-instagram-message: Instagram API error',
        JSON.stringify({ message_id: row.id, ...diagnostics }),
      )
      if (igJson.error?.code === IG_AUTH_ERROR_CODE) {
        return jsonResponse(401, {
          error:
            'Instagram authorization expired. Reconnect the channel in settings to keep sending.',
          provider_error: diagnostics,
        })
      }
      return jsonResponse(502, {
        error: igJson.error?.message ?? 'Instagram send failed',
        provider_error: diagnostics,
      })
    }

    const now = new Date().toISOString()
    const preview = previewFromRow(row)

    // Keep status `sent`; only record the accepted message_id. The webhook
    // advances sent -> read as messaging_seen (read.mid) events arrive.
    const { error: updateMsgError } = await admin
      .from('messages')
      .update({ external_id: providerMessageId })
      .eq('id', row.id)
    if (updateMsgError) {
      console.error('send-instagram-message: message update', updateMsgError)
      return jsonResponse(500, { error: 'Failed to update message' })
    }

    await insertStatusEvent(admin, {
      workspaceId: row.workspace_id,
      messageId: row.id,
      status: 'sent',
    })
    await touchChannelActivity(admin, channelId, 'outbound')

    const { error: updateConvError } = await admin
      .from('conversations')
      .update({ last_message_at: now, last_message_preview: preview })
      .eq('id', row.conversation_id)
    if (updateConvError) {
      console.error('send-instagram-message: conversation update', updateConvError)
      return jsonResponse(500, {
        error: 'Message sent but conversation update failed',
      })
    }

    return jsonResponse(200, {
      ok: true,
      message: { id: row.id, status: 'sent', external_id: providerMessageId },
    })
  },
}
