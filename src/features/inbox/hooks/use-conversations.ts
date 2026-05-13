import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getWorkspaceConversations,
  markConversationRead,
  updateConversationStatus,
} from '../api/conversations'
import { inboxQueryKeys } from '../api/query-keys'
import type {
  ConversationStatus,
  ConversationWithRelations,
} from '../types'

export function useConversations(workspaceId: string) {
  return useQuery({
    queryFn: () => getWorkspaceConversations(workspaceId),
    queryKey: inboxQueryKeys.conversations(workspaceId),
    enabled: !!workspaceId,
  })
}

export function useMarkConversationRead(workspaceId: string) {
  const queryClient = useQueryClient()
  const key = inboxQueryKeys.conversations(workspaceId)

  return useMutation({
    mutationFn: (conversationId: string) =>
      markConversationRead(conversationId),
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot =
        queryClient.getQueryData<Array<ConversationWithRelations>>(key)

      queryClient.setQueryData<Array<ConversationWithRelations>>(
        key,
        (current) =>
          current?.map((row) =>
            row.id === conversationId ? { ...row, unread_count: 0 } : row,
          ),
      )

      return { snapshot }
    },
    onError: (_error, _conversationId, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(key, context.snapshot)
      }
    },
  })
}

export function useUpdateConversationStatus(workspaceId: string) {
  const queryClient = useQueryClient()
  const key = inboxQueryKeys.conversations(workspaceId)

  return useMutation({
    mutationFn: ({
      conversationId,
      status,
    }: {
      conversationId: string
      status: ConversationStatus
    }) => updateConversationStatus({ conversationId, status }),
    onMutate: async ({ conversationId, status }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot =
        queryClient.getQueryData<Array<ConversationWithRelations>>(key)

      queryClient.setQueryData<Array<ConversationWithRelations>>(
        key,
        (current) =>
          current?.map((row) =>
            row.id === conversationId ? { ...row, status } : row,
          ),
      )

      return { snapshot }
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(key, context.snapshot)
      }
    },
  })
}
