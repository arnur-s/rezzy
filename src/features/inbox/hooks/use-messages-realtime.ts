import type { ConversationWithRelations } from '@/entities/conversation'
import { sortConversationsByActivity } from '@/entities/conversation'
import type {
  MessageAttachmentRow,
  MessageRow,
  MessageRowWithAttachments,
} from '@/entities/message'
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_attachments',
        },
        (payload) => {
          const attachment = payload.new as MessageAttachmentRow

          patchInfiniteMessagesCache(queryClient, messagesKey, (current) => {
            if (!current) return current
            return {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                messages: page.messages.map((row) => {
                  if (row.id !== attachment.message_id) return row
                  const withAttachments = row as MessageRowWithAttachments
                  const existing = withAttachments.message_attachments ?? []
                  if (existing.some((item) => item.id === attachment.id)) {
                    return row
                  }
                  return {
                    ...withAttachments,
                    message_attachments: [...existing, attachment].sort(
                      (a, b) => a.position - b.position,
                    ),
                  }
                }),
              })),
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
