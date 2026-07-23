import type { ConversationWithRelations } from '@/entities/conversation'
import { useConversations } from '@/features/inbox/hooks/use-conversations'
import { useConversationsRealtime } from '@/features/inbox/hooks/use-conversations-realtime'
import { useWorkspaceUnreadCounts } from '@/features/inbox/hooks/use-unread-counts'
import { useAuth } from '@/providers/auth-provider'
import { useCallback, useMemo } from 'react'
import { buildUnreadNotificationsViewModel } from '../utils/unread-notifications'

export type UnreadNotificationsResult = {
  items: Array<ConversationWithRelations>
  totalUnread: number
  isPending: boolean
  isError: boolean
  isRetrying: boolean
  retry: () => void
}

/**
 * Unread conversations for the header bell. Hosts the app's single
 * `useConversationsRealtime` mount: the header outlives the inbox page, so
 * both surfaces share one realtime channel and one query cache.
 */
export function useUnreadNotifications(
  workspaceId: string | undefined,
): UnreadNotificationsResult {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const conversationsQuery = useConversations(workspaceId ?? '')
  useConversationsRealtime(workspaceId ?? '')
  const unreadCountsQuery = useWorkspaceUnreadCounts(workspaceId ?? '', userId)

  const { items, totalUnread } = useMemo(
    () =>
      buildUnreadNotificationsViewModel(
        conversationsQuery.data,
        unreadCountsQuery.data,
      ),
    [conversationsQuery.data, unreadCountsQuery.data],
  )

  // Disabled queries stay pending forever; only report loading when the
  // queries can actually run (a workspace route with a signed-in agent).
  const isPending =
    !!workspaceId &&
    (conversationsQuery.isPending || (!!userId && unreadCountsQuery.isPending))
  const isError = conversationsQuery.isError || unreadCountsQuery.isError
  const isRetrying =
    conversationsQuery.isRefetching || unreadCountsQuery.isRefetching

  const { isError: conversationsFailed, refetch: refetchConversations } =
    conversationsQuery
  const { isError: unreadCountsFailed, refetch: refetchUnreadCounts } =
    unreadCountsQuery
  const retry = useCallback(() => {
    if (conversationsFailed) void refetchConversations()
    if (unreadCountsFailed) void refetchUnreadCounts()
  }, [
    conversationsFailed,
    refetchConversations,
    unreadCountsFailed,
    refetchUnreadCounts,
  ])

  return { items, totalUnread, isPending, isError, isRetrying, retry }
}
