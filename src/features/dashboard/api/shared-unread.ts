import { getUnreadCountsForWorkspaces } from '@/features/dashboard/api/unread-counts'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Cache coordinates for the per-agent unread map.
 *
 * Home runs three queries side by side — the summary counts, the attention
 * queue and the per-workspace stats — and every one of them needs the same
 * unread map. Called directly, that is three identical
 * `get_unread_counts_for_workspaces` round trips on every home load and every
 * refetch.
 *
 * Routing them through `ensureUnreadCounts` collapses that to one. React Query
 * dedupes concurrent `ensureQueryData` calls for the same key, so the three
 * still start in parallel and the second and third await the first request
 * instead of issuing their own.
 */
export const unreadCountsQueryKeys = {
  all: ['dashboard', 'unread-counts'] as const,
  forWorkspaces: (workspaceIds: Array<string>) =>
    ['dashboard', 'unread-counts', [...workspaceIds].sort()] as const,
}

/**
 * The unread map for these workspaces, fetched once and shared by every home
 * query in the same load.
 *
 * Lives under the `['dashboard']` root so the existing home invalidation also
 * refreshes it; an unread map that outlived the counts derived from it would
 * reintroduce exactly the staleness that invalidation exists to prevent.
 */
export function ensureUnreadCounts(
  queryClient: QueryClient,
  workspaceIds: Array<string>,
): Promise<Map<string, number>> {
  return queryClient.ensureQueryData({
    queryKey: unreadCountsQueryKeys.forWorkspaces(workspaceIds),
    queryFn: () => getUnreadCountsForWorkspaces(workspaceIds),
  })
}
