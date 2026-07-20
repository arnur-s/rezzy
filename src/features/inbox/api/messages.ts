import type { TablesInsert } from '@/api/types'
import type { ChannelType } from '@/entities/channel'
import type { MessageRow } from '@/entities/message'
import { supabase } from '@/utils/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { mapDatabaseError } from '../utils/error-message'

const MESSAGE_SELECT = `
  id,
  conversation_id,
  workspace_id,
  sender_id,
  direction,
  type,
  status,
  content,
  media_url,
  media_filename,
  media_mime_type,
  media_size,
  metadata,
  external_id,
  created_at
` as const

export const MESSAGE_PAGE_SIZE = 50

export type MessagePageCursor = {
  createdAt: string
  id: string
}

export type MessagesPageResult = {
  messages: Array<MessageRow>
  hasMore: boolean
}

/**
 * Fetches one page of messages, newest first in the query then reversed to ascending.
 * `pages[0]` from infinite query = latest batch; pass cursor to load older rows.
 */
export async function getConversationMessagesPage({
  conversationId,
  cursor = null,
}: {
  conversationId: string
  cursor?: MessagePageCursor | null
}): Promise<MessagesPageResult> {
  let query = supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query.limit(MESSAGE_PAGE_SIZE + 1)

  if (error) {
    throw error
  }

  const rows = data
  const hasMore = rows.length > MESSAGE_PAGE_SIZE
  const page = hasMore ? rows.slice(0, MESSAGE_PAGE_SIZE) : rows

  return {
    messages: [...page].reverse(),
    hasMore,
  }
}

async function markMessageFailed(messageId: string): Promise<void> {
  await supabase
    .from('messages')
    .update({ status: 'failed' })
    .eq('id', messageId)
}

async function mapSendInvokeError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response
    let message: string | undefined
    try {
      const body = (await res.clone().json()) as { error?: string }
      message = body.error
    } catch {
      /* ignore */
    }
    return new Error(message ?? `Send failed (${res.status})`)
  }
  if (error instanceof Error) return error
  return new Error('Send failed')
}

type SendInvokeResult = {
  ok?: boolean
  message?: { id: string; status: string; external_id: string | null }
}

/** Channel types whose outbound messages are delivered by an edge function. */
const REMOTE_SEND_FUNCTIONS: Partial<Record<ChannelType, string>> = {
  telegram: 'send-telegram-message',
  whatsapp: 'send-whatsapp-message',
}

function detectMessageType(
  mimeType: string,
): 'image' | 'video' | 'audio' | 'document' {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document'
}

function sanitizeFilename(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
  return safe || 'file'
}

const CHAT_MEDIA_BUCKET = 'chat-media'

/**
 * Inserts an outbound message row. For file messages, uploads to Storage first
 * then inserts with all media fields in one operation (Option B: client-generated
 * UUID as path segment). Telegram delivery runs in Edge Function after insert.
 */
export async function sendOutboundMessage({
  conversationId,
  workspaceId,
  content,
  file,
  senderId,
  channelType,
}: {
  conversationId: string
  workspaceId: string
  content: string
  file?: File | null
  senderId: string | null
  channelType: ChannelType
}): Promise<MessageRow> {
  const remoteSendFunction = REMOTE_SEND_FUNCTIONS[channelType]

  let insertPayload: TablesInsert<'messages'>
  let storagePath: string | null = null

  if (file) {
    const msgType = detectMessageType(file.type)
    const uuid = crypto.randomUUID()
    const safeFilename = sanitizeFilename(file.name)
    storagePath = `${workspaceId}/${conversationId}/${uuid}/${safeFilename}`
    const mimeType = file.type || 'application/octet-stream'

    const { error: uploadError } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .upload(storagePath, file, { contentType: mimeType, upsert: false })

    if (uploadError) throw uploadError

    insertPayload = {
      conversation_id: conversationId,
      workspace_id: workspaceId,
      direction: 'outbound',
      type: msgType,
      content: content.trim() || null,
      media_url: storagePath,
      media_filename: file.name,
      media_mime_type: mimeType,
      media_size: file.size,
      sender_id: senderId,
      status: 'sent',
    }
  } else {
    insertPayload = {
      conversation_id: conversationId,
      workspace_id: workspaceId,
      direction: 'outbound',
      type: 'text',
      content: content.trim(),
      sender_id: senderId,
      status: 'sent',
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('messages')
    .insert(insertPayload)
    .select(MESSAGE_SELECT)
    .single()

  if (insertError) {
    if (storagePath) {
      await supabase.storage.from(CHAT_MEDIA_BUCKET).remove([storagePath])
    }
    throw mapDatabaseError(insertError.message)
  }

  if (!remoteSendFunction) {
    return inserted
  }

  const { data: invokeData, error: invokeError } =
    await supabase.functions.invoke<SendInvokeResult>(remoteSendFunction, {
      body: { messageId: inserted.id },
    })

  if (invokeError) {
    await markMessageFailed(inserted.id)
    throw await mapSendInvokeError(invokeError)
  }

  if (!invokeData?.ok) {
    await markMessageFailed(inserted.id)
    throw new Error('Send failed')
  }

  const { data: fresh, error: reloadError } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('id', inserted.id)
    .single()

  if (reloadError) {
    throw reloadError
  }

  return fresh
}

