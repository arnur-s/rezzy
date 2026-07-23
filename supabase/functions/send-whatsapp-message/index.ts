// send-whatsapp-message.ts
// Delivers an outbound WhatsApp message via the Cloud API. On success the row
// keeps status `sent` (Meta only *accepted* it) with the returned wamid stored
// as external_id — delivered/read progression arrives later via the webhook's
// statuses[] events. Auth failures surface a distinct "reconnect" error.
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { insertStatusEvent, touchChannelActivity } from '../_shared/persist.ts'

const GRAPH_VERSION = Deno.env.get('WHATSAPP_GRAPH_VERSION') ?? 'v23.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`
const CHAT_MEDIA_BUCKET = 'chat-media'

// Meta error code for an expired/invalid access token.
const WA_AUTH_ERROR_CODE = 190

// Meta error code (test mode only) for a recipient not on the allowed list.
const WA_RECIPIENT_NOT_ALLOWED_CODE = 131030

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
  reply_to_message_id: string | null
}

interface ConversationRow {
  contact_id: string
  channel_id: string
}

interface ChannelRow {
  id: string
  type: string
  is_active: boolean
}

interface WhatsappSendResponse {
  messages?: { id?: string }[]
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

interface WhatsappErrorDiagnostics {
  provider_http_status: number
  code: number | null
  error_subcode: number | null
  type: string | null
  trace_id: string | null
}

type SecretField = 'access_token' | 'phone_number_id'

// WhatsApp media messages that accept a hosted link.
const WA_MEDIA_TYPE: Record<string, 'image' | 'video' | 'audio' | 'document'> =
  {
    image: 'image',
    video: 'video',
    audio: 'audio',
    voice: 'audio',
    document: 'document',
  }

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

function sanitizedProviderString(
  value: unknown,
  maxLength = 200,
): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : null
}

function whatsappErrorDiagnostics(
  responseStatus: number,
  error: WhatsappSendResponse['error'],
): WhatsappErrorDiagnostics {
  return {
    provider_http_status: responseStatus,
    code: typeof error?.code === 'number' ? error.code : null,
    error_subcode:
      typeof error?.error_subcode === 'number' ? error.error_subcode : null,
    type: sanitizedProviderString(error?.type, 100),
    trace_id: sanitizedProviderString(error?.fbtrace_id),
  }
}

/**
 * Marks the outbound message failed and persists safe provider diagnostics
 * (code/subcode/type/trace id — never tokens, bodies, or phone numbers) into
 * the status history.
 */
async function recordSendFailure(
  admin: SupabaseClient,
  row: { id: string; workspace_id: string },
  channelId: string | null,
  diagnostics: Partial<WhatsappErrorDiagnostics> & { reason?: string },
): Promise<void> {
  await admin.from('messages').update({ status: 'failed' }).eq('id', row.id)
  const errorCode =
    diagnostics.code != null ? String(diagnostics.code) : (diagnostics.reason ?? null)
  await insertStatusEvent(admin, {
    workspaceId: row.workspace_id,
    messageId: row.id,
    status: 'failed',
    errorCode,
    errorSubcode:
      diagnostics.error_subcode != null ? String(diagnostics.error_subcode) : null,
    errorType: diagnostics.type ?? null,
    traceId: diagnostics.trace_id ?? null,
    metadata:
      diagnostics.provider_http_status != null
        ? { provider_http_status: diagnostics.provider_http_status }
        : {},
  })
  if (channelId) {
    await touchChannelActivity(admin, channelId, 'error', errorCode)
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
      return '🎧 Audio'
    case 'voice':
      return '🎤 Voice message'
    case 'document':
      return row.media_filename ?? '📎 Document'
    case 'sticker':
      return 'Sticker'
    default:
      return ''
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** Cached recipient override written after a successful trunk-variant retry. */
function readDialOverride(metadata: unknown): string | null {
  const value = asRecord(metadata).whatsapp_dial_id
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Kazakhstan (+7) test-list entries carry the domestic trunk '8' after the
 * country code. Given the canonical 11-digit wa_id (7 + 10 digits), produce the
 * 12-digit domestic variant Meta's test allowed-list matches against. Returns
 * null when no rule applies so the caller can skip the retry.
 */
function trunkVariant(to: string): string | null {
  const m = /^7(\d{10})$/.exec(to)
  if (m) return `78${m[1]}`
  return null
}

interface SendResult {
  ok: boolean
  waMessageId?: string
  error?: WhatsappSendResponse['error']
  httpStatus: number
  failureKind?: 'network' | 'parse' | 'api'
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
      console.error('send-whatsapp-message: missing Supabase env')
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
        'id, workspace_id, conversation_id, direction, status, content, external_id, type, media_url, media_filename, media_mime_type, reply_to_message_id',
      )
      .eq('id', messageId)
      .maybeSingle()

    if (msgError) {
      console.error('send-whatsapp-message: message load error', msgError)
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
      console.error('send-whatsapp-message: membership lookup', memberError)
      return jsonResponse(500, { error: 'Failed to verify access' })
    }

    if (!membership) {
      return jsonResponse(403, { error: 'Not a member of this workspace' })
    }

    if (row.direction !== 'outbound') {
      return jsonResponse(400, { error: 'Message is not outbound' })
    }

    // Idempotency / double-send guard: if Meta already accepted this row it has
    // an external_id — return the current state instead of sending again.
    if (row.external_id) {
      return jsonResponse(200, {
        ok: true,
        message: {
          id: row.id,
          status: row.status,
          external_id: row.external_id,
        },
      })
    }

    if (row.status !== 'sent') {
      return jsonResponse(400, {
        error: `Invalid message status: ${row.status ?? 'null'}`,
      })
    }

    if (row.type === 'text') {
      const content = row.content?.trim() ?? ''
      if (!content) {
        return jsonResponse(400, { error: 'Message has no content' })
      }
    }

    const { data: conversation, error: convError } = await admin
      .from('conversations')
      .select('contact_id, channel_id')
      .eq('id', row.conversation_id)
      .maybeSingle()

    if (convError || !conversation) {
      console.error('send-whatsapp-message: conversation load', convError)
      return jsonResponse(404, { error: 'Conversation not found' })
    }

    const conv = conversation as ConversationRow

    const { data: channel, error: channelError } = await admin
      .from('channels')
      .select('id, type, is_active')
      .eq('id', conv.channel_id)
      .maybeSingle()

    const channelRow = channel as ChannelRow

    if (channelError || !channelRow) {
      console.error('send-whatsapp-message: channel load', channelError)
      return jsonResponse(404, { error: 'Channel not found' })
    }

    if (channelRow.type !== 'whatsapp') {
      return jsonResponse(400, { error: 'Channel is not WhatsApp' })
    }

    if (!channelRow.is_active) {
      await recordSendFailure(admin, row, conv.channel_id, { reason: 'channel_inactive' })
      return jsonResponse(409, {
        error:
          'Channel is inactive. Activate it in settings before sending messages.',
      })
    }

    const { data: credentials, error: secretError } = await admin.rpc(
      'get_channel_credentials',
      { p_channel_id: conv.channel_id },
    )

    if (secretError) {
      console.error('send-whatsapp-message: channel secret load', secretError)
      return jsonResponse(500, { error: 'Failed to load channel secret' })
    }

    if (!hasCredentialObject(credentials)) {
      return jsonResponse(400, { error: 'WhatsApp channel secret missing' })
    }

    const accessToken = getCredentialString(credentials, 'access_token')
    const phoneNumberId = getCredentialString(credentials, 'phone_number_id')
    if (!accessToken || !phoneNumberId) {
      return jsonResponse(400, {
        error: 'WhatsApp credentials missing in channel secret',
      })
    }

    const { data: contactChannel, error: ccError } = await admin
      .from('contact_channels')
      .select('external_id, metadata')
      .eq('contact_id', conv.contact_id)
      .eq('channel_type', 'whatsapp')
      .maybeSingle()

    if (ccError) {
      console.error('send-whatsapp-message: contact_channel load', ccError)
      return jsonResponse(500, { error: 'Failed to load contact channel' })
    }

    if (!contactChannel?.external_id?.trim()) {
      console.error(
        'send-whatsapp-message: no whatsapp external_id for contact',
        conv.contact_id,
      )
      await recordSendFailure(admin, row, conv.channel_id, { reason: 'missing_recipient' })
      return jsonResponse(400, {
        error: 'WhatsApp recipient id missing for contact',
      })
    }

    const canonicalTo = contactChannel.external_id.trim()

    // Outbound replies quote the parent via its provider message id (wamid).
    let replyContext: { message_id: string } | null = null
    if (row.reply_to_message_id) {
      const { data: parent } = await admin
        .from('messages')
        .select('external_id')
        .eq('id', row.reply_to_message_id)
        .maybeSingle()
      if (parent?.external_id) {
        replyContext = { message_id: parent.external_id }
      }
    }
    const cachedDialId = readDialOverride(contactChannel.metadata)
    const to = cachedDialId ?? canonicalTo
    const caption = row.content?.trim() ?? ''
    const waMediaType = WA_MEDIA_TYPE[row.type]

    // Recipient-independent part of the payload, built once and reused across a
    // possible trunk-variant retry.
    let messagePayload: Record<string, unknown>

    if (waMediaType && row.media_url) {
      const { data: signedData, error: signedError } = await admin.storage
        .from(CHAT_MEDIA_BUCKET)
        .createSignedUrl(row.media_url, 3600)

      if (signedError || !signedData?.signedUrl) {
        console.error('send-whatsapp-message: signed URL error', signedError)
        await recordSendFailure(admin, row, conv.channel_id, { reason: 'signed_url_failed' })
        return jsonResponse(502, {
          error: 'Failed to create signed URL for media',
        })
      }

      const mediaPayload: Record<string, string> = {
        link: signedData.signedUrl,
      }
      // Audio does not accept a caption; document/image/video do.
      if (caption && waMediaType !== 'audio') {
        mediaPayload.caption = caption.slice(0, 1024)
      }
      if (waMediaType === 'document' && row.media_filename) {
        mediaPayload.filename = row.media_filename
      }

      messagePayload = { type: waMediaType, [waMediaType]: mediaPayload }
    } else {
      const content = row.content?.trim() ?? ''
      messagePayload = { type: 'text', text: { body: content } }
    }

    const postToWhatsapp = async (recipient: string): Promise<SendResult> => {
      const requestBody: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        ...(replyContext ? { context: replyContext } : {}),
        ...messagePayload,
      }

      let waRes: Response
      try {
        waRes = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })
      } catch (e) {
        logNetworkError('send-whatsapp-message: WhatsApp network error', e)
        return { ok: false, httpStatus: 0, failureKind: 'network' }
      }

      let waJson: WhatsappSendResponse
      try {
        waJson = (await waRes.json()) as WhatsappSendResponse
      } catch (e) {
        const parseErrorType = e instanceof Error ? e.name : typeof e
        console.error(
          'send-whatsapp-message: invalid WhatsApp API response',
          JSON.stringify({
            message_id: row.id,
            provider_http_status: waRes.status,
            parse_error_type: parseErrorType,
          }),
        )
        return { ok: false, httpStatus: waRes.status, failureKind: 'parse' }
      }

      const waMessageId = waJson.messages?.[0]?.id
      if (waMessageId) {
        return { ok: true, waMessageId, httpStatus: waRes.status }
      }

      const providerError = whatsappErrorDiagnostics(waRes.status, waJson.error)
      console.error(
        'send-whatsapp-message: WhatsApp API error',
        JSON.stringify({
          message_id: row.id,
          ...providerError,
          request_body_keys: Object.keys(requestBody),
          recipient_length: recipient.length,
          recipient_digits_only: /^\d+$/.test(recipient),
          recipient_e164_shape: /^[1-9]\d{6,14}$/.test(recipient),
          message_type: requestBody.type,
        }),
      )
      return {
        ok: false,
        httpStatus: waRes.status,
        failureKind: 'api',
        error: waJson.error,
      }
    }

    let result = await postToWhatsapp(to)

    // Test-mode only: if Meta rejects the canonical wa_id as "not in allowed
    // list", retry once with the country trunk variant. Gated on no cached
    // override so it fires at most once per contact.
    if (
      !result.ok &&
      result.error?.code === WA_RECIPIENT_NOT_ALLOWED_CODE &&
      !cachedDialId
    ) {
      const variant = trunkVariant(canonicalTo)
      if (variant && variant !== to) {
        const retry = await postToWhatsapp(variant)
        if (retry.ok) {
          result = retry
          // Cache the working recipient so future sends go direct. Stored in
          // metadata, not external_id, which is the inbound-matching key.
          const { error: cacheError } = await admin
            .from('contact_channels')
            .update({
              metadata: {
                ...asRecord(contactChannel.metadata),
                whatsapp_dial_id: variant,
              },
            })
            .eq('contact_id', conv.contact_id)
            .eq('channel_type', 'whatsapp')
          if (cacheError) {
            console.error(
              'send-whatsapp-message: dial id cache failed',
              cacheError,
            )
          }
        }
      }
    }

    if (!result.ok) {
      await recordSendFailure(admin, row, conv.channel_id, {
        ...whatsappErrorDiagnostics(result.httpStatus, result.error),
        ...(result.failureKind !== 'api' ? { reason: result.failureKind } : {}),
      })

      if (result.failureKind === 'network') {
        return jsonResponse(502, { error: 'WhatsApp request failed' })
      }
      if (result.failureKind === 'parse') {
        return jsonResponse(502, {
          error: 'WhatsApp returned an invalid response',
          provider_error: whatsappErrorDiagnostics(
            result.httpStatus,
            undefined,
          ),
        })
      }

      const providerError = whatsappErrorDiagnostics(
        result.httpStatus,
        result.error,
      )
      if (result.error?.code === WA_AUTH_ERROR_CODE) {
        return jsonResponse(401, {
          error:
            'WhatsApp authorization expired. Reconnect the channel in settings to keep sending.',
          provider_error: providerError,
        })
      }
      return jsonResponse(502, {
        error: result.error?.message ?? 'WhatsApp send failed',
        provider_error: providerError,
      })
    }

    const waMessageId = result.waMessageId
    if (!waMessageId) {
      await recordSendFailure(admin, row, conv.channel_id, { reason: 'missing_wamid' })
      return jsonResponse(502, { error: 'WhatsApp send failed' })
    }

    const now = new Date().toISOString()
    const preview = previewFromRow(row)

    // Keep status `sent`; only record the accepted wamid. The webhook advances
    // sent -> delivered -> read as statuses[] events arrive.
    const { error: updateMsgError } = await admin
      .from('messages')
      .update({ external_id: waMessageId })
      .eq('id', row.id)

    if (updateMsgError) {
      console.error('send-whatsapp-message: message update', updateMsgError)
      return jsonResponse(500, { error: 'Failed to update message' })
    }

    await insertStatusEvent(admin, {
      workspaceId: row.workspace_id,
      messageId: row.id,
      status: 'sent',
    })
    await touchChannelActivity(admin, conv.channel_id, 'outbound')

    const { error: updateConvError } = await admin
      .from('conversations')
      .update({ last_message_at: now, last_message_preview: preview })
      .eq('id', row.conversation_id)

    if (updateConvError) {
      console.error(
        'send-whatsapp-message: conversation update',
        updateConvError,
      )
      return jsonResponse(500, {
        error: 'Message sent but conversation update failed',
      })
    }

    return jsonResponse(200, {
      ok: true,
      message: {
        id: row.id,
        status: 'sent',
        external_id: waMessageId,
      },
    })
  },
}
