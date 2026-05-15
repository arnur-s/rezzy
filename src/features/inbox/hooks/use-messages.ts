import type { ChannelType } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import { sortConversationsByActivity } from '@/entities/conversation'
import type { MessageRow } from '@/entities/message'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getConversationMessages, sendOutboundMessage } from '../api/messages'
import { inboxQueryKeys } from '../api/query-keys'

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryFn: () => getConversationMessages(conversationId!),
    queryKey: inboxQueryKeys.messages(conversationId ?? ''),
    enabled: !!conversationId,
  })
}

export function useSendMessage({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      conversationId,
      content,
      senderId,
      channelType,
    }: {
      conversationId: string
      content: string
      senderId: string | null
      channelType: ChannelType
    }) =>
      sendOutboundMessage({
        conversationId,
        workspaceId,
        content,
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
                    last_message_preview: message.content?.trim() || null,
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
