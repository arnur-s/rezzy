import type {
  ConversationStatus,
  ConversationWithRelations,
} from '@/entities/conversation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getWorkspaceConversations,
  getWorkspaceConversationsBySearch,
  markConversationRead,
  updateConversationStatus,
} from '../api/conversations'
import { inboxQueryKeys } from '../api/query-keys'

export function useConversations(workspaceId: string) {
  return useQuery({
    queryFn: () => getWorkspaceConversations(workspaceId),
    queryKey: inboxQueryKeys.conversations(workspaceId),
    enabled: !!workspaceId,
  })
}

export function useConversationsSearch(workspaceId: string, searchQuery: string) {
  return useQuery({
    queryFn: () => getWorkspaceConversationsBySearch(workspaceId, searchQuery),
    queryKey: inboxQueryKeys.conversationSearch(workspaceId, searchQuery),
    enabled: !!workspaceId && searchQuery.trim().length > 0,
  })
}

export function useMarkConversationRead(workspaceId: string) {
  const queryClient = useQueryClient()
  const unreadKey = inboxQueryKeys.unreadCountsForWorkspace(workspaceId)

  return useMutation({
    mutationFn: (conversationId: string) =>
      markConversationRead(conversationId),
    onMutate: async (conversationId) => {
      // Unread is per-agent now: optimistically zero this conversation's count
      // for the current user (the shared conversations.unread_count column has
      // been removed).
      await queryClient.cancelQueries({ queryKey: unreadKey })
      const unreadSnapshots = queryClient.getQueriesData<
        Record<string, number>
      >({ queryKey: unreadKey })

      queryClient.setQueriesData<Record<string, number>>(
        { queryKey: unreadKey },
        (current) =>
          current ? { ...current, [conversationId]: 0 } : current,
      )

      return { unreadSnapshots }
    },
    onError: (_error, _conversationId, context) => {
      for (const [key, data] of context?.unreadSnapshots ?? []) {
        queryClient.setQueryData(key, data)
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
