import type { MessageReactionRow } from '@/entities/message'
import { supabase } from '@/utils/supabase'

/**
 * Active (non-removed) reactions for a conversation, keyed by message id in
 * the hook layer. Removed rows are audit history and never rendered.
 */
export async function getConversationReactions(
  conversationId: string,
): Promise<Array<MessageReactionRow>> {
  const { data, error } = await supabase
    .from('message_reactions')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('action', 'added')
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }
  return data
}
