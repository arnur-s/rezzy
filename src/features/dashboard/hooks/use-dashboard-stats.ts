import {
  dashboardQueryKeys,
  getDashboardStats,
} from '@/features/dashboard/api/dashboard-stats'
import { ensureUnreadCounts } from '@/features/dashboard/api/shared-unread'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export function useDashboardStats(workspaceIds: Array<string>) {
  const queryClient = useQueryClient()

  return useQuery({
    queryFn: () =>
      getDashboardStats(
        workspaceIds,
        ensureUnreadCounts(queryClient, workspaceIds),
      ),
    queryKey: dashboardQueryKeys.stats(workspaceIds),
    enabled: workspaceIds.length > 0,
  })
}
