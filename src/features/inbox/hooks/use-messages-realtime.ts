import type { ConversationWithRelations } from '@/entities/conversation'
import { sortConversationsByActivity } from '@/entities/conversation'
import type { MessageRow } from '@/entities/message'
import { supabase } from '@/utils/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { inboxQueryKeys } from '../api/query-keys'
import { listPreviewFromMessage } from '../schemas/message-metadata'
import {
  appendMessageToNewestPage,
  patchInfiniteMessagesCache,
  updateMessageInPages,
} from '../utils/message-pages'

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

          patchInfiniteMessagesCache(queryClient, messagesKey, (current) => {
            if (!current) {
              return {
                pages: [{ messages: [message], hasMore: false }],
                pageParams: [null],
              }
            }

            return {
              ...current,
              pages: appendMessageToNewestPage(current.pages, message),
            }
          })

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

          patchInfiniteMessagesCache(queryClient, messagesKey, (current) => {
            if (!current) {
              return {
                pages: [{ messages: [message], hasMore: false }],
                pageParams: [null],
              }
            }

            return {
              ...current,
              pages: updateMessageInPages(current.pages, message),
            }
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, workspaceId, queryClient])
}
