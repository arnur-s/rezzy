import type { ConversationWithRelations } from '@/entities/conversation'
import { sortConversationsByActivity } from '@/entities/conversation'
import type { MessageRow } from '@/entities/message'
import { supabase } from '@/utils/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { inboxQueryKeys } from '../api/query-keys'
import { listPreviewFromMessage } from '../schemas/message-metadata'

/**
 * Subscribes to INSERT and UPDATE on messages for the open thread, and keeps
 * the conversation list preview / order in sync for new messages.
 */
export function useMessagesRealtime({
  conversationId,
  workspaceId,
}: {
  conversationId: string | null
  workspaceId: string
}) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!conversationId) return

    const messagesKey = inboxQueryKeys.messages(conversationId)
    const conversationsKey = inboxQueryKeys.conversations(workspaceId)

    const patchConversationList = (message: MessageRow) => {
      const preview =
        listPreviewFromMessage(message) ?? message.content?.trim() ?? null

      queryClient.setQueryData<Array<ConversationWithRelations>>(
        conversationsKey,
        (current) => {
          const mapped =
            current?.map((row) =>
              row.id === conversationId
                ? {
                    ...row,
                    last_message_at: message.created_at,
                    last_message_preview:
                      preview ?? row.last_message_preview ?? null,
                  }
                : row,
            ) ?? current
          return mapped ? sortConversationsByActivity(mapped) : mapped
        },
      )
    }

    const channel = supabase
      .channel(`inbox:messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const message = payload.new as MessageRow

          queryClient.setQueryData<Array<MessageRow>>(
            messagesKey,
            (current) => {
              if (!current) return [message]
              if (current.some((row) => row.id === message.id)) return current
              return [...current, message].sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
              )
            },
          )

          patchConversationList(message)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const message = payload.new as MessageRow

          queryClient.setQueryData<Array<MessageRow>>(
            messagesKey,
            (current) => {
              if (!current) return [message]
              return current.map((row) =>
                row.id === message.id ? { ...row, ...message } : row,
              )
            },
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, workspaceId, queryClient])
}
