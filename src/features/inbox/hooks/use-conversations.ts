import type {
  ConversationStatus,
  ConversationWithRelations,
} from '@/entities/conversation'
import { useInvalidateDashboard } from '@/features/dashboard/hooks/use-invalidate-dashboard'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getWorkspaceConversations,
  getWorkspaceConversationsBySearch,
  markConversationRead,
  updateConversationAssignee,
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
  const invalidateDashboard = useInvalidateDashboard()
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
    // Home's summary and attention queue are derived from this conversation's
    // read state. onSettled rather than onSuccess, so a rolled-back failure also
    // re-syncs home instead of leaving it agreeing with an optimistic zero that
    // never reached the server.
    onSettled: invalidateDashboard,
  })
}

export function useUpdateConversationStatus(workspaceId: string) {
  const queryClient = useQueryClient()
  const invalidateDashboard = useInvalidateDashboard()
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
    // open/snoozed/closed decides whether a conversation appears in home's
    // summary and attention queue at all.
    onSettled: invalidateDashboard,
  })
}

/**
 * Reassigns a conversation, or clears its assignee when `assignedTo` is null.
 *
 * Optimistic, like the status mutation beside it, and for the same reason:
 * routing a thread is a triage gesture in the middle of a queue, and a control
 * that waits on a round trip before showing the new owner turns a one-second
 * decision into a stall. The rollback restores the whole list snapshot, so a
 * rejected write cannot leave the row disagreeing with the server.
 *
 * `p_assigned_to` is validated in the database, not here:
 * `trg_ensure_conversation_assignee_is_workspace_member` rejects an id that is
 * not a current member of the conversation's workspace, so a stale roster
 * cannot assign work to somebody who has left.
 */
export function useUpdateConversationAssignee(workspaceId: string) {
  const queryClient = useQueryClient()
  const invalidateDashboard = useInvalidateDashboard()
  const key = inboxQueryKeys.conversations(workspaceId)

  return useMutation({
    mutationFn: ({
      conversationId,
      assignedTo,
    }: {
      conversationId: string
      assignedTo: string | null
    }) => updateConversationAssignee({ conversationId, assignedTo }),
    onMutate: async ({ conversationId, assignedTo }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot =
        queryClient.getQueryData<Array<ConversationWithRelations>>(key)

      queryClient.setQueryData<Array<ConversationWithRelations>>(
        key,
        (current) =>
          current?.map((row) =>
            row.id === conversationId
              ? { ...row, assigned_to: assignedTo }
              : row,
          ),
      )

      return { snapshot }
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(key, context.snapshot)
      }
    },
    onSettled: () => {
      // Search results are a separate query and are not patched above, so a row
      // reassigned while a search is open would keep the old face until the
      // query happened to refetch.
      void queryClient.invalidateQueries({
        queryKey: inboxQueryKeys.conversationSearchAll(workspaceId),
      })
      // Home's attention queue and its "assigned to me" counts both filter on
      // conversations.assigned_to.
      invalidateDashboard()
    },
  })
}
