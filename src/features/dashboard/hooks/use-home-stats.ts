import {
  getHomeStats,
  homeStatsQueryKeys,
} from '@/features/dashboard/api/home-stats'
import { useQuery } from '@tanstack/react-query'

export function useHomeStats(
  userId: string | undefined,
  workspaceIds: Array<string>,
) {
  return useQuery({
    queryFn: () => getHomeStats(userId!, workspaceIds),
    queryKey: homeStatsQueryKeys.forUser(userId ?? '', workspaceIds),
    enabled: !!userId && workspaceIds.length > 0,
  })
}
