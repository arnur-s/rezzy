import type { ContactDetail } from '@/entities/contact'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { listContactConversations } from '../api/contact-conversations'
import {
  createContact,
  getWorkspaceContact,
  searchWorkspaceContacts,
  updateContact,
} from '../api/contacts'
import type { ContactListPage, ContactWritePayload } from '../api/contacts'
import { contactQueryKeys } from '../api/query-keys'
import type { ContactListParams } from '../model/contact-list-params'

export function useContactList(workspaceId: string, params: ContactListParams) {
  return useQuery({
    queryKey: contactQueryKeys.list(workspaceId, params),
    queryFn: () => searchWorkspaceContacts({ workspaceId, params }),
    enabled: Boolean(workspaceId),
    // Paging should not blank the table out from under the reader.
    placeholderData: (previous) => previous,
  })
}

export function useContactDetail(workspaceId: string, contactId: string) {
  return useQuery({
    queryKey: contactQueryKeys.detail(workspaceId, contactId),
    queryFn: () => getWorkspaceContact({ workspaceId, contactId }),
    enabled: Boolean(workspaceId && contactId),
  })
}

export function useContactConversations(
  workspaceId: string,
  contactId: string,
) {
  return useQuery({
    queryKey: contactQueryKeys.conversations(workspaceId, contactId),
    queryFn: () => listContactConversations({ workspaceId, contactId }),
    enabled: Boolean(workspaceId && contactId),
  })
}

/**
 * Patch one contact in every cached page of ONE workspace's directory.
 *
 * Scoped to `lists(workspaceId)` rather than a global list prefix: a workspace
 * switch must not be able to write another workspace's cache, and workspace B's
 * cached pages must not be dropped because workspace A changed.
 */
function patchCachedLists(
  queryClient: QueryClient,
  workspaceId: string,
  contact: ContactDetail,
) {
  queryClient.setQueriesData<ContactListPage>(
    { queryKey: contactQueryKeys.lists(workspaceId) },
    (page) => {
      if (!page) return page
      // Checked up front rather than with a flag set inside the map, so pages
      // that do not hold this contact keep their identity and do not re-render.
      if (!page.items.some((item) => item.id === contact.id)) return page

      return {
        ...page,
        items: page.items.map((item) =>
          item.id === contact.id
            ? {
                ...item,
                name: contact.name,
                phone: contact.phone,
                email: contact.email,
                avatar_url: contact.avatar_url,
                status: contact.status,
                tags: contact.tags,
                owner_id: contact.owner_id,
                updated_at: contact.updated_at,
              }
            : item,
        ),
      }
    },
  )
}

export function useCreateContact(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ContactWritePayload) =>
      createContact({ workspaceId, payload }),
    onSuccess: (created) => {
      queryClient.setQueryData(
        contactQueryKeys.detail(workspaceId, created.id),
        created,
      )
      // Never splice a new row into a cached page: where it lands depends on the
      // active sort, the active filters may exclude it entirely, and totalCount
      // would drift out of step with the rows. A refetch is cheaper than being
      // subtly wrong.
      void queryClient.invalidateQueries({
        queryKey: contactQueryKeys.lists(workspaceId),
      })
    },
  })
}

export function useUpdateContact(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient()
  const detailKey = contactQueryKeys.detail(workspaceId, contactId)

  return useMutation({
    mutationFn: (patch: Partial<ContactWritePayload>) =>
      updateContact({ workspaceId, contactId, patch }),

    // The server response is authoritative and is written before the list is
    // touched, so a list row can never be newer than the detail it came from.
    onSuccess: (updated) => {
      queryClient.setQueryData(detailKey, updated)
      patchCachedLists(queryClient, workspaceId, updated)

      // Mark this workspace's pages stale WITHOUT refetching. The row's position
      // and the total may now be wrong under the active sort and filters, but
      // pulling the list out from under someone who just edited a contact —
      // making the row they are looking at jump or vanish — is worse than a
      // momentarily mis-sorted list. The next mount or refocus re-sorts it.
      void queryClient.invalidateQueries({
        queryKey: contactQueryKeys.lists(workspaceId),
        refetchType: 'none',
      })
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: detailKey }),
  })
}
