import type { MessageReactionRow } from '@/entities/message'
import { applyReactionRow, dedupeReactions } from '@/entities/message'
import { supabase } from '@/utils/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { getConversationReactions } from '../api/reactions'
import { inboxQueryKeys } from '../api/query-keys'

/**
 * Active reactions for the open conversation, grouped by message id for
 * rendering under bubbles.
 */
export function useConversationReactions(conversationId: string | null) {
  const query = useQuery({
    queryFn: () => getConversationReactions(conversationId!),
    queryKey: inboxQueryKeys.reactions(conversationId ?? ''),
    enabled: !!conversationId,
  })

  const reactionsByMessageId = useMemo(() => {
    const map = new Map<string, Array<MessageReactionRow>>()
    // A reactor that reached the same emoji through two provider spellings has
    // two rows; the reaction happened once.
    for (const reaction of dedupeReactions(query.data ?? [])) {
      if (!reaction.message_id) continue
      const list = map.get(reaction.message_id)
      if (list) {
        list.push(reaction)
      } else {
        map.set(reaction.message_id, [reaction])
      }
    }
    return map
  }, [query.data])

  return { reactionsByMessageId, isPending: query.isPending }
}

/**
 * Keeps the reactions cache live: webhook-driven INSERT/UPDATE rows replace or
 * remove cached entries (a row flipping to action='removed' disappears).
 *
 * A reaction is not a message. This subscription touches the reactions cache
 * and nothing else — no conversation preview, no unread counts, and no
 * notification of any kind — so a counter ticking up never announces itself or
 * marks a thread unread. Re-delivered events are absorbed by
 * `applyReactionRow`, which is why nothing here reports a duplicate as an error.
 */
export function useReactionsRealtime(conversationId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!conversationId) return

    const reactionsKey = inboxQueryKeys.reactions(conversationId)

    const applyRow = (row: MessageReactionRow) => {
      if (row.conversation_id !== conversationId) return
      queryClient.setQueryData<Array<MessageReactionRow>>(
        reactionsKey,
        (current) => applyReactionRow(current ?? [], row),
      )
    }

    const channel = supabase
      .channel(`inbox:reactions:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => applyRow(payload.new as MessageReactionRow),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_reactions',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => applyRow(payload.new as MessageReactionRow),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, queryClient])
}
