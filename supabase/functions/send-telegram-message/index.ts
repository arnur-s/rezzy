// send-telegram-message.ts
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { resolveOutboundRoute } from '../_shared/outbound-route.ts'
import { insertStatusEvent, touchChannelActivity } from '../_shared/persist.ts'

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

interface TelegramSendMessageResponse {
  ok: boolean
  description?: string
  error_code?: number
  result?: { message_id: number }
}

/**
 * Marks the outbound message failed and records a status-history event with
 * safe provider diagnostics (never tokens or chat contents).
 */
async function recordSendFailure(
  admin: SupabaseClient,
  row: { id: string; workspace_id: string },
  channelId: string | null,
  errorCode: string | null,
  errorDetail: string | null,
): Promise<void> {
  await admin.from('messages').update({ status: 'failed' }).eq('id', row.id)
  await insertStatusEvent(admin, {
    workspaceId: row.workspace_id,
    messageId: row.id,
    status: 'failed',
    errorCode,
    errorType: errorDetail,
  })
  if (channelId) {
    await touchChannelActivity(admin, channelId, 'error', errorCode)
  }
}

type SecretField = 'bot_token' | 'webhook_secret'

const TELEGRAM_MEDIA_METHOD: Record<string, string> = {
  image: 'sendPhoto',
  video: 'sendVideo',
  audio: 'sendAudio',
  voice: 'sendVoice',
  document: 'sendDocument',
}

const TELEGRAM_MEDIA_FIELD: Record<string, string> = {
  image: 'photo',
  video: 'video',
  audio: 'audio',
  voice: 'voice',
  document: 'document',
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    headers: JSON_HEADERS,
    status,
  })
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

function logTelegramNetworkError(context: string, error: unknown): void {
  const detail = error instanceof Error ? error.name : typeof error
  console.error(`${context}: ${detail}`)
}

function previewFromRow(row: MessageRow): string {
  const trimmed = row.content?.trim() ?? ''
  if (trimmed) return trimmed.length > 100 ? trimmed.slice(0, 100) : trimmed
  switch (row.type) {
    case 'image':    return '📷 Photo'
    case 'video':    return '🎥 Video'
    case 'audio':    return '🎧 Audio'
    case 'voice':    return '🎤 Voice message'
    case 'document': return row.media_filename ?? '📎 Document'
    case 'sticker':  return 'Sticker'
    default:         return ''
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
      console.error('send-telegram-message: missing Supabase env')
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
      console.error('send-telegram-message: message load error', msgError)
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
      console.error('send-telegram-message: membership lookup', memberError)
      return jsonResponse(500, { error: 'Failed to verify access' })
    }

    if (!membership) {
      return jsonResponse(403, { error: 'Not a member of this workspace' })
    }

    if (row.direction !== 'outbound') {
      return jsonResponse(400, { error: 'Message is not outbound' })
    }

    if (row.status === 'delivered' && row.external_id) {
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

    // Both lookups are scoped to the message's workspace. Without that, a
    // conversation repointed at another workspace's channel would send on that
    // workspace's credentials -- see _shared/outbound-route.ts.
    const resolved = await resolveOutboundRoute(admin, {
      workspaceId: row.workspace_id,
      conversationId: row.conversation_id,
      context: 'send-telegram-message',
    })

    if (!resolved.ok) {
      return jsonResponse(404, {
        error:
          resolved.reason === 'conversation_not_found'
            ? 'Conversation not found'
            : 'Channel not found',
      })
    }

    const { contactId, channelId, channelType, channelIsActive } =
      resolved.route

    if (channelType !== 'telegram') {
      return jsonResponse(400, { error: 'Channel is not Telegram' })
    }

    if (!channelIsActive) {
      await recordSendFailure(admin, row, channelId, 'channel_inactive', null)

      return jsonResponse(409, {
        error:
          'Channel is inactive. Activate it in settings before sending messages.',
      })
    }
    const { data: credentials, error: secretError } = await admin.rpc(
      'get_channel_credentials',
      { p_channel_id: channelId },
    )

    if (secretError) {
      console.error('send-telegram-message: channel secret load', secretError)
      return jsonResponse(500, { error: 'Failed to load channel secret' })
    }

    if (!hasCredentialObject(credentials)) {
      return jsonResponse(400, {
        error: 'Telegram channel secret missing',
      })
    }

    const botToken = getCredentialString(credentials, 'bot_token')
    if (!botToken) {
      return jsonResponse(400, {
        error: 'Telegram bot token missing in channel secret',
      })
    }

    const { data: contactChannel, error: ccError } = await admin
      .from('contact_channels')
      .select('external_id')
      .eq('contact_id', contactId)
      .eq('channel_type', 'telegram')
      .maybeSingle()

    if (ccError) {
      console.error('send-telegram-message: contact_channel load', ccError)
      return jsonResponse(500, { error: 'Failed to load contact channel' })
    }

    if (!contactChannel?.external_id?.trim()) {
      console.error(
        'send-telegram-message: no telegram external_id for contact',
        contactId,
      )
      await recordSendFailure(
        admin,
        row,
        channelId,
        'missing_chat_id',
        null,
      )
      return jsonResponse(400, {
        error: 'Telegram chat id missing for contact',
      })
    }

    const chatId = contactChannel.external_id.trim()

    // Outbound replies use the parent's provider message id when known.
    let replyParameters: { message_id: number } | null = null
    if (row.reply_to_message_id) {
      const { data: parent } = await admin
        .from('messages')
        .select('external_id')
        .eq('id', row.reply_to_message_id)
        .maybeSingle()
      const parentExternalId = Number(parent?.external_id ?? '')
      if (Number.isInteger(parentExternalId) && parentExternalId > 0) {
        replyParameters = { message_id: parentExternalId }
      }
    }

    let telegramJson: TelegramSendMessageResponse
    const isMediaType = row.type !== 'text' && row.type !== 'sticker'

    if (isMediaType && row.media_url) {
      const { data: signedData, error: signedError } = await admin.storage
        .from('chat-media')
        .createSignedUrl(row.media_url, 3600)

      if (signedError || !signedData?.signedUrl) {
        console.error('send-telegram-message: signed URL error', signedError)
        await recordSendFailure(admin, row, channelId, 'signed_url_failed', null)
        return jsonResponse(502, { error: 'Failed to create signed URL for media' })
      }

      const method = TELEGRAM_MEDIA_METHOD[row.type] ?? 'sendDocument'
      const field = TELEGRAM_MEDIA_FIELD[row.type] ?? 'document'
      const tgBody: Record<string, unknown> = {
        chat_id: chatId,
        [field]: signedData.signedUrl,
      }
      const caption = row.content?.trim() ?? ''
      if (caption) tgBody.caption = caption.slice(0, 1024)
      if (replyParameters) tgBody.reply_parameters = replyParameters

      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${botToken}/${method}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tgBody),
          },
        )
        telegramJson = (await tgRes.json()) as TelegramSendMessageResponse
      } catch (e) {
        logTelegramNetworkError(
          'send-telegram-message: Telegram network error',
          e,
        )
        await recordSendFailure(admin, row, channelId, 'network_error', null)
        return jsonResponse(502, { error: 'Telegram request failed' })
      }
    } else {
      const content = row.content?.trim() ?? ''
      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: content,
              ...(replyParameters ? { reply_parameters: replyParameters } : {}),
            }),
          },
        )
        telegramJson = (await tgRes.json()) as TelegramSendMessageResponse
      } catch (e) {
        logTelegramNetworkError(
          'send-telegram-message: Telegram network error',
          e,
        )
        await recordSendFailure(admin, row, channelId, 'network_error', null)
        return jsonResponse(502, { error: 'Telegram request failed' })
      }
    }

    if (!telegramJson.ok || telegramJson.result?.message_id == null) {
      console.error(
        'send-telegram-message: Telegram API error',
        JSON.stringify(telegramJson),
      )
      await recordSendFailure(
        admin,
        row,
        channelId,
        telegramJson.error_code != null ? String(telegramJson.error_code) : null,
        telegramJson.description ?? null,
      )
      return jsonResponse(502, {
        error: telegramJson.description ?? 'Telegram send failed',
      })
    }

    const telegramMessageId = String(telegramJson.result.message_id)
    const now = new Date().toISOString()
    const preview = previewFromRow(row)

    const { error: updateMsgError } = await admin
      .from('messages')
      .update({
        status: 'delivered',
        external_id: telegramMessageId,
      })
      .eq('id', row.id)

    if (updateMsgError) {
      console.error('send-telegram-message: message update', updateMsgError)
      return jsonResponse(500, { error: 'Failed to update message' })
    }

    await insertStatusEvent(admin, {
      workspaceId: row.workspace_id,
      messageId: row.id,
      status: 'delivered',
    })
    await touchChannelActivity(admin, channelId, 'outbound')

    const { error: updateConvError } = await admin
      .from('conversations')
      .update({
        last_message_at: now,
        last_message_preview: preview,
      })
      .eq('id', row.conversation_id)

    if (updateConvError) {
      console.error(
        'send-telegram-message: conversation update',
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
        status: 'delivered',
        external_id: telegramMessageId,
      },
    })
  },
}
