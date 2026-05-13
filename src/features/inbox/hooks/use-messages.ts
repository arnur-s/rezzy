import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getConversationMessages,
  sendOutboundMessage,
} from '../api/messages'
import { inboxQueryKeys } from '../api/query-keys'
import type { ChannelType } from '../types'

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryFn: () => getConversationMessages(conversationId!),
    queryKey: inboxQueryKeys.messages(conversationId ?? ''),
    enabled: !!conversationId,
  })
}

export function useSendMessage({
  workspaceId,
}: {
  workspaceId: string
}) {
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
      void queryClient.invalidateQueries({
        queryKey: inboxQueryKeys.messages(message.conversation_id),
      })
      void queryClient.invalidateQueries({
        queryKey: inboxQueryKeys.conversations(workspaceId),
      })
    },
  })
}
