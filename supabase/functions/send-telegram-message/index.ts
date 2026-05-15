// send-telegram-message.ts
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

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
}

interface ConversationRow {
  contact_id: string
  channel_id: string
}

interface TelegramSendMessageResponse {
  ok: boolean
  description?: string
  result?: { message_id: number }
}

type SecretField = 'bot_token' | 'webhook_secret'

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    headers: JSON_HEADERS,
    status,
  })
}

function getCredentialString(
  credentials: unknown,
  field: SecretField,
): string {
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

function previewFromText(text: string): string {
  const t = text.trim()
  return t.length > 100 ? t.slice(0, 100) : t
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
        'id, workspace_id, conversation_id, direction, status, content, external_id',
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

    const content = row.content?.trim() ?? ''
    if (!content) {
      return jsonResponse(400, { error: 'Message has no content' })
    }

    const { data: conversation, error: convError } = await admin
      .from('conversations')
      .select('contact_id, channel_id')
      .eq('id', row.conversation_id)
      .maybeSingle()

    if (convError || !conversation) {
      console.error('send-telegram-message: conversation load', convError)
      return jsonResponse(404, { error: 'Conversation not found' })
    }

    const conv = conversation as ConversationRow

    const { data: channel, error: channelError } = await admin
      .from('channels')
      .select('id, type')
      .eq('id', conv.channel_id)
      .maybeSingle()

    if (channelError || !channel) {
      console.error('send-telegram-message: channel load', channelError)
      return jsonResponse(404, { error: 'Channel not found' })
    }

    if (channel.type !== 'telegram') {
      return jsonResponse(400, { error: 'Channel is not Telegram' })
    }

    const { data: credentials, error: secretError } = await admin.rpc(
      'get_channel_credentials',
      { p_channel_id: conv.channel_id },
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
      .eq('contact_id', conv.contact_id)
      .eq('channel_type', 'telegram')
      .maybeSingle()

    if (ccError) {
      console.error('send-telegram-message: contact_channel load', ccError)
      return jsonResponse(500, { error: 'Failed to load contact channel' })
    }

    if (!contactChannel?.external_id?.trim()) {
      console.error(
        'send-telegram-message: no telegram external_id for contact',
        conv.contact_id,
      )
      await admin.from('messages').update({ status: 'failed' }).eq('id', row.id)
      return jsonResponse(400, {
        error: 'Telegram chat id missing for contact',
      })
    }

    const chatId = contactChannel.external_id.trim()

    let telegramJson: TelegramSendMessageResponse
    try {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: content }),
        },
      )
      telegramJson = (await tgRes.json()) as TelegramSendMessageResponse
    } catch (e) {
      logTelegramNetworkError(
        'send-telegram-message: Telegram network error',
        e,
      )
      await admin.from('messages').update({ status: 'failed' }).eq('id', row.id)
      return jsonResponse(502, { error: 'Telegram request failed' })
    }

    if (!telegramJson.ok || telegramJson.result?.message_id == null) {
      console.error(
        'send-telegram-message: Telegram API error',
        JSON.stringify(telegramJson),
      )
      await admin.from('messages').update({ status: 'failed' }).eq('id', row.id)
      return jsonResponse(502, {
        error: telegramJson.description ?? 'Telegram sendMessage failed',
      })
    }

    const telegramMessageId = String(telegramJson.result.message_id)
    const now = new Date().toISOString()
    const preview = previewFromText(content)

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
