import {
  dashboardQueryKeys,
  getDashboardStats,
} from '@/features/dashboard/api/dashboard-stats'
import { useQuery } from '@tanstack/react-query'

export function useDashboardStats(workspaceIds: Array<string>) {
  return useQuery({
    queryFn: () => getDashboardStats(workspaceIds),
    queryKey: dashboardQueryKeys.stats(workspaceIds),
    enabled: workspaceIds.length > 0,
  })
}
