import type { Tables } from '@/api/types'
import { supabase } from '@/utils/supabase'

export type ConversationReadCursor = Pick<
  Tables<'conversation_reads'>,
  'last_read_at' | 'last_read_message_id'
>

export async function getConversationReadCursor({
  conversationId,
  userId,
}: {
  conversationId: string
  userId: string
}): Promise<ConversationReadCursor | null> {
  const { data, error } = await supabase
    .from('conversation_reads')
    .select('last_read_message_id, last_read_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function markConversationReadToMessage({
  conversationId,
  lastReadMessageId,
}: {
  conversationId: string
  lastReadMessageId: string
}): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
    p_last_read_message_id: lastReadMessageId,
  })

  if (error) {
    throw error
  }
}
