import {
  attentionQueueQueryKeys,
  getAttentionQueue,
} from '@/features/dashboard/api/attention-queue'
import { useQuery } from '@tanstack/react-query'

export function useAttentionQueue(
  userId: string | undefined,
  workspaceIds: Array<string>,
) {
  return useQuery({
    queryFn: () => getAttentionQueue(userId!, workspaceIds),
    queryKey: attentionQueueQueryKeys.forUser(userId ?? '', workspaceIds),
    enabled: !!userId && workspaceIds.length > 0,
  })
}
