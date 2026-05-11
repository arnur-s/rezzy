// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// ─── Telegram types ───────────────────────────────────────────────────────────

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: { id: number }
  date: number
  text?: string
  photo?: { file_id: string; file_unique_id: string }[]
  video?: { file_id: string; file_unique_id: string }
  audio?: { file_id: string; file_unique_id: string }
  voice?: { file_id: string; file_unique_id: string }
  document?: { file_id: string; file_unique_id: string; mime_type?: string }
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

interface ChannelCredentials {
  bot_token?: string
  webhook_secret?: string
}

// ─── Message type resolver ────────────────────────────────────────────────────

function getMessageType(message: TelegramMessage): string {
  if (message.photo) return 'image'
  if (message.video) return 'video'
  if (message.audio || message.voice) return 'audio'
  if (message.document) return 'document'
  return 'text'
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(req: Request): Promise<Response> {
    // Only accept POST
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Extract channel id from URL: /functions/v1/telegram-webhook/<channel_id>
    const url = new URL(req.url)
    const channelId = url.pathname.split('/').pop()

    if (!channelId) {
      return new Response('Missing channel id', { status: 400 })
    }

    // Service role client — bypasses RLS for webhook operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── 1. Find the channel (credentials for webhook secret verification) ───
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, workspace_id, is_active, credentials')
      .eq('id', channelId)
      .eq('type', 'telegram')
      .single()

    if (channelError || !channel) {
      console.error('Channel not found:', channelId)
      return new Response('Channel not found', { status: 404 })
    }

    const creds = channel.credentials as ChannelCredentials | null
    const expectedSecret = creds?.webhook_secret
    const secretFromHeader = req.headers.get('x-telegram-bot-api-secret-token')
    if (expectedSecret && secretFromHeader !== expectedSecret) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Parse Telegram update
    let update: TelegramUpdate
    try {
      update = await req.json()
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    if (!channel.is_active) {
      return new Response('OK', { status: 200 })
    }

    // Only handle messages (ignore edited_message, channel_post etc for now)
    const message = update.message
    if (!message || !message.from) {
      return new Response('OK', { status: 200 })
    }

    const workspaceId: string = channel.workspace_id
    const externalUserId = String(message.from.id)
    const externalName =
      [message.from.first_name, message.from.last_name]
        .filter(Boolean)
        .join(' ') ||
      message.from.username ||
      'Unknown'

    // ── 2. Find or create contact ────────────────────────────────────────────

    // First check if this telegram user already has a contact in this workspace
    const { data: existingContactChannel } = await supabase
      .from('contact_channels')
      .select('contact_id, contacts!inner(workspace_id)')
      .eq('channel_type', 'telegram')
      .eq('external_id', externalUserId)
      .eq('contacts.workspace_id', workspaceId)
      .maybeSingle()

    let contactId: string

    if (existingContactChannel) {
      // Known contact
      contactId = existingContactChannel.contact_id

      // Update their display name if it changed
      await supabase
        .from('contact_channels')
        .update({ external_name: externalName })
        .eq('contact_id', contactId)
        .eq('channel_type', 'telegram')
        .eq('external_id', externalUserId)
    } else {
      // New contact — create contact row first
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          workspace_id: workspaceId,
          name: externalName,
          status: 'new',
        })
        .select('id')
        .single()

      if (contactError || !newContact) {
        console.error('Failed to create contact:', contactError)
        return new Response('Failed to create contact', { status: 500 })
      }

      contactId = newContact.id

      // Link contact to telegram
      await supabase.from('contact_channels').insert({
        contact_id: contactId,
        channel_type: 'telegram',
        external_id: externalUserId,
        external_name: externalName,
      })
    }

    // ── 3. Find or create conversation ──────────────────────────────────────

    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('channel_id', channelId)
      .maybeSingle()

    let conversationId: string

    if (existingConversation) {
      conversationId = existingConversation.id
    } else {
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          workspace_id: workspaceId,
          contact_id: contactId,
          channel_id: channelId,
          status: 'open',
          unread_count: 0,
        })
        .select('id')
        .single()

      if (convError || !newConversation) {
        console.error('Failed to create conversation:', convError)
        return new Response('Failed to create conversation', { status: 500 })
      }

      conversationId = newConversation.id
    }

    // ── 4. Deduplicate — check if message already stored ────────────────────

    const externalMessageId = String(update.update_id)

    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('external_id', externalMessageId)
      .maybeSingle()

    if (existingMessage) {
      // Telegram sometimes sends the same update twice — ignore
      return new Response('OK', { status: 200 })
    }

    // ── 5. Insert message ────────────────────────────────────────────────────

    const messageType = getMessageType(message)
    const content = message.text ?? null
    const preview = content ? content.slice(0, 100) : `[${messageType}]`

    const { error: messageError } = await supabase.from('messages').insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      external_id: externalMessageId,
      direction: 'inbound',
      type: messageType,
      content,
      sender_id: null, // inbound = from contact, not an agent
      status: 'delivered',
    })

    if (messageError) {
      console.error('Failed to insert message:', messageError)
      return new Response('Failed to insert message', { status: 500 })
    }

    // ── 6. Update conversation preview + unread count ────────────────────────

    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: preview,
        status: 'open', // reopen if it was closed
        unread_count: supabase.rpc('increment_unread', {
          conversation_id: conversationId,
        }),
      })
      .eq('id', conversationId)

    console.info(
      `Message stored — workspace: ${workspaceId}, contact: ${contactId}, conversation: ${conversationId}`,
    )

    // Telegram expects 200 OK quickly or it will retry
    return new Response('OK', { status: 200 })
  },
}
