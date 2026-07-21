import { useQuery } from '@tanstack/react-query'
import { inboxQueryKeys } from '../api/query-keys'
import { getWorkspaceUnreadCounts } from '../api/unread-counts'

export function useWorkspaceUnreadCounts(
  workspaceId: string,
  userId: string | null,
) {
  return useQuery({
    queryKey: inboxQueryKeys.unreadCounts(workspaceId, userId ?? 'anonymous'),
    queryFn: () => getWorkspaceUnreadCounts(workspaceId),
    enabled: !!workspaceId && !!userId,
  })
}
