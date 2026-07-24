import type { ConversationWithRelations } from '@/entities/conversation'
import { getWorkspaceConversations } from '@/features/inbox/api/conversations'
import { inboxQueryKeys } from '@/features/inbox/api/query-keys'
import { getWorkspaceUnreadCounts } from '@/features/inbox/api/unread-counts'
import { useConversationsRealtime } from '@/features/inbox/hooks/use-conversations-realtime'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { useAuth } from '@/providers/auth-provider'
import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { UnreadNotification } from '../utils/unread-notifications'
import { buildUnreadNotificationsViewModel } from '../utils/unread-notifications'

export type UnreadNotificationsResult = {
  items: Array<UnreadNotification>
  totalUnread: number
  isPending: boolean
  isError: boolean
  isRetrying: boolean
  retry: () => void
}

function hasUnread(counts: Record<string, number> | undefined): boolean {
  return !!counts && Object.values(counts).some((count) => count > 0)
}

/**
 * Unread conversations for the header bell, across every workspace the agent
 * belongs to — the header is global, and routes like the home page have no
 * active workspace of their own.
 *
 * Queries reuse the inbox's own keys and fetchers, so the popover shares one
 * cache with the inbox: reading a thread updates the badge through the existing
 * optimistic mark-read path, with no second source of truth.
 *
 * Also hosts the app's single `useConversationsRealtime` mount for the active
 * workspace; the header outlives the inbox page, so both share one channel.
 */
export function useUnreadNotifications(
  activeWorkspaceId: string | undefined,
): UnreadNotificationsResult {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const workspacesQuery = useWorkspaces(userId ?? undefined)
  const workspaces = useMemo(
    () => workspacesQuery.data ?? [],
    [workspacesQuery.data],
  )

  useConversationsRealtime(activeWorkspaceId ?? '')

  // Cheap per-agent RPCs; only conversations with unread come back.
  const countsQueries = useQueries({
    queries: workspaces.map((workspace) => ({
      queryKey: inboxQueryKeys.unreadCounts(workspace.id, userId ?? 'anonymous'),
      queryFn: () => getWorkspaceUnreadCounts(workspace.id),
      enabled: !!userId,
    })),
  })

  // Conversation details are only needed where something is actually unread.
  // The active workspace is usually already cached by the inbox.
  const conversationsQueries = useQueries({
    queries: workspaces.map((workspace, index) => ({
      queryKey: inboxQueryKeys.conversations(workspace.id),
      queryFn: () => getWorkspaceConversations(workspace.id),
      enabled: hasUnread(countsQueries[index]?.data),
    })),
  })

  const unreadCounts = useMemo(() => {
    const merged: Record<string, number> = {}
    for (const query of countsQueries) {
      if (query.data) Object.assign(merged, query.data)
    }
    return merged
  }, [countsQueries])

  const conversations = useMemo(() => {
    const merged: Array<ConversationWithRelations> = []
    for (const query of conversationsQueries) {
      if (query.data) merged.push(...query.data)
    }
    return merged
  }, [conversationsQueries])

  // A single workspace needs no label — it would repeat on every row.
  const workspaceNames = useMemo(() => {
    const names = new Map<string, string>()
    if (workspaces.length > 1) {
      for (const workspace of workspaces) names.set(workspace.id, workspace.name)
    }
    return names
  }, [workspaces])

  const { items, totalUnread } = useMemo(
    () =>
      buildUnreadNotificationsViewModel(
        conversations,
        unreadCounts,
        workspaceNames,
      ),
    [conversations, unreadCounts, workspaceNames],
  )

  // Disabled queries stay `isPending` forever, so treat "no data and no error"
  // on a query we actually expect to run as the loading signal.
  const countsPending = countsQueries.some(
    (query) => query.data === undefined && !query.isError,
  )
  const conversationsPending = conversationsQueries.some(
    (query, index) =>
      hasUnread(countsQueries[index]?.data) &&
      query.data === undefined &&
      !query.isError,
  )
  const isPending =
    !!userId &&
    (workspacesQuery.isPending || countsPending || conversationsPending)

  const isError =
    workspacesQuery.isError ||
    countsQueries.some((query) => query.isError) ||
    conversationsQueries.some((query) => query.isError)
  const isRetrying =
    workspacesQuery.isRefetching ||
    countsQueries.some((query) => query.isRefetching) ||
    conversationsQueries.some((query) => query.isRefetching)

  // Not memoized: the query arrays are rebuilt every render from `workspaces`,
  // so a stable identity here would only capture a stale snapshot.
  const retry = () => {
    if (workspacesQuery.isError) void workspacesQuery.refetch()
    for (const query of [...countsQueries, ...conversationsQueries]) {
      if (query.isError) void query.refetch()
    }
  }

  return { items, totalUnread, isPending, isError, isRetrying, retry }
}
