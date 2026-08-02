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
import { isMissingFunctionError } from '@/utils/supabase-rpc'
import { listContactPhones, setContactPhones } from '../api/contact-phones'
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

/**
 * Every number one contact can be reached on, primary first.
 *
 * Separate from the detail query because `contacts.phone` (the primary) is what
 * the directory, the inbox panel and the list rows read; only the detail view
 * and the edit form need the whole set.
 */
export function useContactPhones(workspaceId: string, contactId: string) {
  return useQuery({
    queryKey: contactQueryKeys.phones(workspaceId, contactId),
    queryFn: () => listContactPhones({ workspaceId, contactId }),
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

/**
 * A contact write plus the full set of numbers it can be reached on.
 *
 * `phones` is optional: a caller that only has the one number keeps passing
 * `payload.phone` and nothing changes for it. When it IS given, it is the whole
 * set — `contacts.phone` is its first entry, and `public.set_contact_phones`
 * writes both in one statement pair so the two cannot drift.
 */
export type ContactWriteInput = ContactWritePayload & {
  phones?: Array<string>
}

async function writePhoneSet({
  workspaceId,
  contactId,
  phones,
}: {
  workspaceId: string
  contactId: string
  phones: Array<string> | undefined
}): Promise<void> {
  if (!phones) return

  try {
    await setContactPhones({ workspaceId, contactId, phones })
  } catch (error) {
    // The RPC ships with a migration, so between deploying this code and
    // applying that migration it does not exist. A single number is already
    // fully stored by `contacts.phone`, so saving it succeeds either way; a set
    // the column cannot hold is a real failure and is reported as one.
    if (isMissingFunctionError(error) && phones.length <= 1) return
    throw error
  }
}

export function useCreateContact(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ phones, ...payload }: ContactWriteInput) => {
      const created = await createContact({ workspaceId, payload })
      // After the insert, not inside it: the numbers hang off a contact id that
      // does not exist until the insert returns. A failure here surfaces as a
      // failed save with the contact already created, which the form reports —
      // better than silently keeping one number out of the set the user typed.
      await writePhoneSet({ workspaceId, contactId: created.id, phones })
      return created
    },
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
      // A shared-contact card in the inbox asks "does this person exist yet?".
      // The answer just changed, so every open lookup in this workspace has to
      // be asked again — otherwise the card that created this contact keeps
      // offering to create it a second time.
      void queryClient.invalidateQueries({
        queryKey: contactQueryKeys.matches(workspaceId),
      })
    },
  })
}

export function useUpdateContact(workspaceId: string, contactId: string) {
  const queryClient = useQueryClient()
  const detailKey = contactQueryKeys.detail(workspaceId, contactId)

  return useMutation({
    mutationFn: async ({ phones, ...patch }: Partial<ContactWriteInput>) => {
      // Numbers first: `set_contact_phones` syncs `contacts.phone` to the new
      // primary, and the update below carries the same value, so whichever runs
      // last writes the same thing. Reversing the order would let the RPC's sync
      // overwrite a phone the patch had just cleared.
      await writePhoneSet({ workspaceId, contactId, phones })
      return updateContact({ workspaceId, contactId, patch })
    },

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

      // An edit can add or remove the phone or email a shared-contact card
      // matches on, so identity lookups are stale for the same reason a create
      // makes them stale.
      void queryClient.invalidateQueries({
        queryKey: contactQueryKeys.matches(workspaceId),
      })
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: detailKey }),
  })
}
