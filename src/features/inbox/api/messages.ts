import { supabase } from '@/utils/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'

import type { ChannelType, MessageRow } from '../types'

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
  media_mime_type,
  metadata,
  external_id,
  created_at
` as const

export async function getConversationMessages(
  conversationId: string,
): Promise<Array<MessageRow>> {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return data
}

async function markMessageFailed(messageId: string): Promise<void> {
  await supabase
    .from('messages')
    .update({ status: 'failed' })
    .eq('id', messageId)
}

async function mapSendTelegramInvokeError(error: unknown): Promise<Error> {
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

type SendTelegramInvokeResult = {
  ok?: boolean
  message?: { id: string; status: string; external_id: string | null }
}

/**
 * Inserts an outbound message row. Telegram delivery runs in Edge Function
 * `send-telegram-message` after insert (`sent` → `delivered` / `failed` → read).
 */
export async function sendOutboundMessage({
  conversationId,
  workspaceId,
  content,
  senderId,
  channelType,
}: {
  conversationId: string
  workspaceId: string
  content: string
  senderId: string | null
  channelType: ChannelType
}): Promise<MessageRow> {
  const isTelegram = channelType === 'telegram'

  const { data: inserted, error: insertError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      workspace_id: workspaceId,
      direction: 'outbound',
      type: 'text',
      content,
      sender_id: senderId,
      status: 'sent',
    })
    .select(MESSAGE_SELECT)
    .single()

  if (insertError) {
    throw insertError
  }

  if (!isTelegram) {
    return inserted
  }

  const { data: invokeData, error: invokeError } =
    await supabase.functions.invoke<SendTelegramInvokeResult>(
      'send-telegram-message',
      { body: { messageId: inserted.id } },
    )

  if (invokeError) {
    await markMessageFailed(inserted.id)
    throw await mapSendTelegramInvokeError(invokeError)
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
