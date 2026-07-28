import {
  getHomeStats,
  homeStatsQueryKeys,
} from '@/features/dashboard/api/home-stats'
import { ensureUnreadCounts } from '@/features/dashboard/api/shared-unread'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export function useHomeStats(
  userId: string | undefined,
  workspaceIds: Array<string>,
) {
  const queryClient = useQueryClient()

  return useQuery({
    // The unread map is shared with the attention queue and the workspace
    // stats, which mount alongside this one; going through the cache makes the
    // three a single RPC instead of three identical ones.
    queryFn: () =>
      getHomeStats(
        userId!,
        workspaceIds,
        ensureUnreadCounts(queryClient, workspaceIds),
      ),
    queryKey: homeStatsQueryKeys.forUser(userId ?? '', workspaceIds),
    enabled: !!userId && workspaceIds.length > 0,
  })
}
