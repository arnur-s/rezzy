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
 * How long one fetched unread map may be reused.
 *
 * This exists to collapse the three home queries of a single load into one
 * request, not to cache across loads, so it only has to span the moment the
 * three start together. Invalidation overrides it regardless of length:
 * `fetchQuery` treats an invalidated query as stale, which is what keeps the
 * map moving with the counts derived from it.
 */
const SHARE_WINDOW_MS = 5_000

/**
 * The unread map for these workspaces, fetched once and shared by every home
 * query in the same load.
 *
 * `fetchQuery` rather than `ensureQueryData`: ensure returns whatever is in the
 * cache even after an invalidation, which would leave the summary and the
 * attention list deriving fresh conversation rows from a stale unread map — the
 * exact staleness the dashboard invalidation exists to prevent. fetchQuery
 * still dedupes concurrent callers into one request.
 *
 * Keyed under the `['dashboard']` root so the existing home invalidation
 * reaches it.
 */
export function ensureUnreadCounts(
  queryClient: QueryClient,
  workspaceIds: Array<string>,
): Promise<Map<string, number>> {
  return queryClient.fetchQuery({
    queryKey: unreadCountsQueryKeys.forWorkspaces(workspaceIds),
    queryFn: () => getUnreadCountsForWorkspaces(workspaceIds),
    staleTime: SHARE_WINDOW_MS,
  })
}
