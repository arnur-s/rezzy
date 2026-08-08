import type { ContactDetail } from '@/entities/contact'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { attentionQueueQueryKeys } from '@/features/dashboard/api/attention-queue'
import { homeStatsQueryKeys } from '@/features/dashboard/api/home-stats'
import { inboxQueryKeys } from '@/features/inbox/api/query-keys'
import {
  countContactConversations,
  listContactConversations,
} from '../api/contact-conversations'
import {
  archiveContact,
  createContact,
  getWorkspaceContact,
  listArchivedContacts,
  restoreContact,
  searchWorkspaceContacts,
  updateContact,
} from '../api/contacts'
import type { ContactListPage, ContactWritePayload } from '../api/contacts'
import { isMissingFunctionError } from '@/utils/supabase-rpc'
import { listContactPhones, setContactPhones } from '../api/contact-phones'
import { contactQueryKeys } from '../api/query-keys'
import type { ContactListParams } from '../model/contact-list-params'

export function useContactList(
  workspaceId: string,
  params: ContactListParams,
  /** False while the Archived view is showing, which is served by its own RPC. */
  enabled = true,
) {
  return useQuery({
    queryKey: contactQueryKeys.list(workspaceId, params),
    queryFn: () => searchWorkspaceContacts({ workspaceId, params }),
    enabled: enabled && Boolean(workspaceId),
    // Paging should not blank the table out from under the reader.
    placeholderData: (previous) => previous,
  })
}

/**
 * The Archived filter's page. `enabled` is the caller's admin check: the RPC
 * raises 42501 for a member, so a non-admin must not reach it at all rather
 * than render an error the UI has no answer for.
 */
export function useArchivedContacts({
  workspaceId,
  query,
  page,
  enabled,
}: {
  workspaceId: string
  query: string
  page: number
  enabled: boolean
}) {
  return useQuery({
    queryKey: contactQueryKeys.archivedList(workspaceId, query, page),
    queryFn: () => listArchivedContacts({ workspaceId, query, page }),
    enabled: enabled && Boolean(workspaceId),
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
 * The exact number of conversations a contact has, for the archive dialog.
 *
 * Separate from `useContactConversations`, which caps at five for display.
 * `enabled` keeps it to the moment the dialog opens rather than firing on every
 * contact anyone opens.
 */
export function useContactConversationCount(
  workspaceId: string,
  contactId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: contactQueryKeys.conversationCount(workspaceId, contactId),
    queryFn: () => countContactConversations({ workspaceId, contactId }),
    enabled: enabled && Boolean(workspaceId && contactId),
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

/**
 * Everything that changes shape when one contact is archived or restored.
 *
 * Archiving is the only mutation in this feature that moves rows between two
 * tables' worth of surfaces: the contact leaves the directory, its conversations
 * leave the inbox, and both leave the dashboard's counts. Realtime cannot be
 * relied on for the conversation half — Supabase evaluates RLS per subscriber,
 * so the acting admin is the one client guaranteed NOT to be told about rows
 * that just became invisible.
 *
 * Both directions invalidate the same set, because both change the same
 * surfaces.
 */
function invalidateArchiveSurfaces(
  queryClient: QueryClient,
  workspaceId: string,
) {
  const keys = [
    contactQueryKeys.lists(workspaceId),
    contactQueryKeys.archived(workspaceId),
    // A shared-contact card in the inbox asks "is this person already in the
    // CRM?". An archived contact must stop answering yes, or the card offers to
    // open a contact that no longer resolves.
    contactQueryKeys.matches(workspaceId),
    inboxQueryKeys.conversations(workspaceId),
    inboxQueryKeys.conversationSearchAll(workspaceId),
    inboxQueryKeys.unreadCountsForWorkspace(workspaceId),
    // The dashboard filters conversations by assignee, so archiving a thread
    // assigned to the acting admin changes their own attention queue and home
    // stats. Invalidated by prefix: both are keyed by user and workspace set.
    attentionQueueQueryKeys.all,
    homeStatsQueryKeys.all,
  ]

  for (const queryKey of keys) {
    void queryClient.invalidateQueries({ queryKey })
  }
}

/**
 * Archive one contact and, through the database cascade, its conversations.
 *
 * Owner/admin only — enforced by `public.archive_contact`, not by the caller
 * hiding the button. Nothing is deleted and nothing is scrubbed: the rows keep
 * every field, and an inbound message from the same contact reverses this
 * automatically.
 */
export function useArchiveContact(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (contactId: string) => archiveContact(contactId),
    onSuccess: (_result, contactId) => {
      // Dropped rather than invalidated: the contact is now invisible to this
      // caller's SELECT policy, so a refetch would resolve to null and render
      // the not-found state on a route that is already navigating away.
      queryClient.removeQueries({
        queryKey: contactQueryKeys.detail(workspaceId, contactId),
      })
      invalidateArchiveSurfaces(queryClient, workspaceId)
    },
  })
}

export function useRestoreContact(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (contactId: string) => restoreContact(contactId),
    onSuccess: () => invalidateArchiveSurfaces(queryClient, workspaceId),
  })
}
