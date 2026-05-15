import type { ChannelType } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import { sortConversationsByActivity } from '@/entities/conversation'
import type { MessageRow } from '@/entities/message'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getConversationMessages, sendOutboundMessage } from '../api/messages'
import { inboxQueryKeys } from '../api/query-keys'
import type { ConversationReadCursor } from '../api/read-cursors'
import {
  getConversationReadCursor,
  markConversationReadToMessage,
} from '../api/read-cursors'
import { listPreviewFromMessage } from '../schemas/message-metadata'

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryFn: () => getConversationMessages(conversationId!),
    queryKey: inboxQueryKeys.messages(conversationId ?? ''),
    enabled: !!conversationId,
  })
}

export function useConversationReadCursor({
  conversationId,
  userId,
}: {
  conversationId: string | null
  userId: string | null
}) {
  return useQuery({
    queryFn: () =>
      getConversationReadCursor({
        conversationId: conversationId!,
        userId: userId!,
      }),
    queryKey: inboxQueryKeys.readCursor(conversationId ?? '', userId ?? ''),
    enabled: !!conversationId && !!userId,
  })
}

export function useMarkConversationReadToMessage({
  workspaceId,
  userId,
}: {
  workspaceId: string
  userId: string | null
}) {
  const queryClient = useQueryClient()
  const conversationsKey = inboxQueryKeys.conversations(workspaceId)

  return useMutation({
    mutationFn: ({
      conversationId,
      lastReadMessageId,
    }: {
      conversationId: string
      lastReadMessageId: string
    }) => markConversationReadToMessage({ conversationId, lastReadMessageId }),
    onSuccess: (_data, { conversationId, lastReadMessageId }) => {
      queryClient.setQueryData<Array<ConversationWithRelations>>(
        conversationsKey,
        (current) =>
          current?.map((row) =>
            row.id === conversationId ? { ...row, unread_count: 0 } : row,
          ),
      )

      if (!userId) return

      queryClient.setQueryData<ConversationReadCursor | null>(
        inboxQueryKeys.readCursor(conversationId, userId),
        {
          last_read_message_id: lastReadMessageId,
          last_read_at: new Date().toISOString(),
        },
      )
    },
  })
}

export function useSendMessage({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      conversationId,
      content,
      file,
      senderId,
      channelType,
    }: {
      conversationId: string
      content: string
      file?: File | null
      senderId: string | null
      channelType: ChannelType
    }) =>
      sendOutboundMessage({
        conversationId,
        workspaceId,
        content,
        file,
        senderId,
        channelType,
      }),

    onSuccess: (message) => {
      const messagesKey = inboxQueryKeys.messages(message.conversation_id)
      const conversationsKey = inboxQueryKeys.conversations(workspaceId)

      queryClient.setQueryData<Array<MessageRow>>(messagesKey, (current) => {
        if (!current) return [message]
        if (current.some((row) => row.id === message.id)) return current

        return [...current, message].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )
      })

      queryClient.setQueryData<Array<ConversationWithRelations>>(
        conversationsKey,
        (current) => {
          if (!current) return current

          return sortConversationsByActivity(
            current.map((conversation) =>
              conversation.id === message.conversation_id
                ? {
                    ...conversation,
                    last_message_at: message.created_at,
                    last_message_preview: listPreviewFromMessage(message),
                    assigned_to:
                      conversation.assigned_to ?? message.sender_id ?? null,
                  }
                : conversation,
            ),
          )
        },
      )
    },
  })
}
