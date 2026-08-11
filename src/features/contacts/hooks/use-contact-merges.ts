import { attentionQueueQueryKeys } from '@/features/dashboard/api/attention-queue'
import { homeStatsQueryKeys } from '@/features/dashboard/api/home-stats'
import { inboxQueryKeys } from '@/features/inbox/api/query-keys'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  countContactMergeChildren,
  listDuplicateContactGroups,
  mergeContacts,
} from '../api/contact-merges'
import type { MergeContactsInput } from '../api/contact-merges'
import { contactQueryKeys } from '../api/query-keys'

/**
 * The duplicates view's page.
 *
 * `staleTime` is deliberate: behind this is a group-by over every live contact
 * in the workspace, not a point lookup. It is cheap enough to open, and far too
 * expensive to refetch on every window focus.
 */
export function useDuplicateContactGroups({
  workspaceId,
  page,
  enabled,
}: {
  workspaceId: string
  page: number
  enabled: boolean
}) {
  return useQuery({
    queryKey: contactQueryKeys.duplicatesPage(workspaceId, page),
    queryFn: () => listDuplicateContactGroups({ workspaceId, page }),
    enabled: enabled && Boolean(workspaceId),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })
}

/**
 * What a merge would move off one contact. Fetched only while the dialog is
 * open — `enabled` is the dialog's own state — because the confirmation is the
 * only thing that needs it.
 */
export function useContactMergeChildren(
  workspaceId: string,
  contactId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: contactQueryKeys.mergeChildren(workspaceId, contactId),
    queryFn: () => countContactMergeChildren({ workspaceId, contactId }),
    enabled: enabled && Boolean(workspaceId && contactId),
  })
}

/**
 * Merge two contacts.
 *
 * The invalidation is wider than this feature's usual, and deliberately: a
 * merge moves conversations between contacts, so the inbox is as stale as the
 * directory. Everything under the workspace's contact keys goes — directory
 * pages, the archive, the duplicates scan, both details, and the identity
 * lookups a shared-contact card reads.
 */
export function useMergeContacts(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: MergeContactsInput) => mergeContacts(input),

    onSuccess: (_result, input) => {
      // Dropped rather than invalidated: the merged contact is now invisible to
      // this caller's SELECT policy, so a refetch resolves to null and renders
      // the not-found state on a route that may be navigating away.
      queryClient.removeQueries({
        queryKey: contactQueryKeys.detail(workspaceId, input.mergedId),
      })

      const keys = [
        contactQueryKeys.workspace(workspaceId),
        inboxQueryKeys.conversations(workspaceId),
        inboxQueryKeys.conversationSearchAll(workspaceId),
        inboxQueryKeys.unreadCountsForWorkspace(workspaceId),
        attentionQueueQueryKeys.all,
        homeStatsQueryKeys.all,
      ]

      for (const queryKey of keys) {
        void queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
