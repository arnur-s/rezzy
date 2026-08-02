import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getWorkspacePhoneRegion,
  setWorkspacePhoneRegion,
  workspacePhoneRegionQueryKeys,
} from '../api/workspace-phone-region'

/**
 * The workspace's default phone region, or null when it has none.
 *
 * Read as its own query rather than off the workspace detail: it is consumed by
 * the inbox (every shared-contact card) and by the contact form, neither of
 * which wants the whole workspace record, and it changes about once in a
 * workspace's life — hence the long stale time.
 */
export function useWorkspacePhoneRegion(workspaceId: string) {
  return useQuery({
    queryKey: workspacePhoneRegionQueryKeys.detail(workspaceId),
    queryFn: () => getWorkspacePhoneRegion(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useSetWorkspacePhoneRegion(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (region: string | null) =>
      setWorkspacePhoneRegion({ workspaceId, region }),
    onSuccess: (region) => {
      queryClient.setQueryData(
        workspacePhoneRegionQueryKeys.detail(workspaceId),
        region,
      )
      // Every open identity lookup read the old region, so their answers are
      // now unsound: a number that was ambiguous may now be placeable, and vice
      // versa. Dropping the whole contact cache for this workspace is cheaper
      // than reasoning about which entries survived.
      void queryClient.invalidateQueries({
        queryKey: ['contacts', workspaceId],
      })
    },
  })
}
