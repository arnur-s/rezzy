import {
  attentionQueueQueryKeys,
  getAttentionQueue,
  getUnassignedQueue,
} from '@/features/dashboard/api/attention-queue'
import { ensureUnreadCounts } from '@/features/dashboard/api/shared-unread'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export function useAttentionQueue(
  userId: string | undefined,
  workspaceIds: Array<string>,
) {
  const queryClient = useQueryClient()

  return useQuery({
    queryFn: () =>
      getAttentionQueue(
        userId!,
        workspaceIds,
        ensureUnreadCounts(queryClient, workspaceIds),
      ),
    queryKey: attentionQueueQueryKeys.forUser(userId ?? '', workspaceIds),
    enabled: !!userId && workspaceIds.length > 0,
  })
}

export function useUnassignedQueue(workspaceIds: Array<string>) {
  return useQuery({
    queryFn: () => getUnassignedQueue(workspaceIds),
    queryKey: attentionQueueQueryKeys.unassigned(workspaceIds),
    enabled: workspaceIds.length > 0,
  })
}
