import type { ContactDetail, ContactListItem } from '@/entities/contact'
import { callRpc } from '@/utils/supabase-rpc'
import { supabase } from '@/utils/supabase'
import { z } from 'zod'
import { CONTACTS_PAGE_SIZE } from '../model/contact-list-params'
import type { ContactListParams } from '../model/contact-list-params'

const CONTACT_DETAIL_SELECT = `
  id,
  workspace_id,
  name,
  phone,
  email,
  avatar_url,
  status,
  source,
  tags,
  owner_id,
  last_seen_at,
  created_at,
  updated_at,
  deleted_at,
  merged_into_id,
  merged_at,
  merged_by,
  contact_channels(id, channel_type, external_id, external_name, channel_id)
` as const

export type ContactListPage = {
  items: Array<ContactListItem>
  totalCount: number
}

export async function searchWorkspaceContacts({
  workspaceId,
  params,
  pageSize = CONTACTS_PAGE_SIZE,
}: {
  workspaceId: string
  params: ContactListParams
  pageSize?: number
}): Promise<ContactListPage> {
  // undefined is dropped by JSON.stringify, so the SQL DEFAULT applies and an
  // unused facet never arrives as an empty-array predicate.
  const { data, error } = await supabase.rpc('search_workspace_contacts', {
    p_workspace_id: workspaceId,
    p_query: params.query.trim() || undefined,
    p_statuses: params.statuses.length ? [...params.statuses] : undefined,
    p_tags: params.tags.length ? [...params.tags] : undefined,
    p_owner_ids: params.ownerIds.length ? [...params.ownerIds] : undefined,
    p_include_unowned: params.includeUnowned,
    p_sort: params.sort,
    p_limit: pageSize,
    p_offset: Math.max(params.page - 1, 0) * pageSize,
  })

  if (error) throw error

  // The generated Returns type marks every column non-nullable, which is wrong
  // for a RETURNS TABLE. ContactListItem carries the real nullabilities.
  const items = data as unknown as Array<ContactListItem>

  // total_count is repeated on every row; no rows means no matches.
  return { items, totalCount: items[0]?.total_count ?? 0 }
}

/**
 * Filters `workspace_id` explicitly, unlike `getContactById` in the inbox
 * feature. RLS alone is not enough here: a user who belongs to workspaces A and
 * B can open /workspaces/A/contacts/<id-owned-by-B> and RLS will happily return
 * B's contact inside A's shell. The route's workspace is part of the identity of
 * the record being fetched, so it belongs in the predicate, not only in the
 * cache key.
 *
 * `maybeSingle()` so a mismatched id is a clean null the route renders as
 * not-found, rather than a thrown PGRST116.
 */
export async function getWorkspaceContact({
  workspaceId,
  contactId,
}: {
  workspaceId: string
  contactId: string
}): Promise<ContactDetail | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select(CONTACT_DETAIL_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('id', contactId)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * The survivor a merged contact was folded into, or `null` for every other
 * case (no such contact, a different workspace, an ordinary archived contact,
 * a live one, or a caller with no membership in the workspace) — the RPC
 * folds all of those into one indistinguishable `null` on purpose.
 *
 * Not part of `getWorkspaceContact`: the contacts SELECT policy hides a
 * merged row from every ordinary query the instant it becomes one
 * (`deleted_at is null` is in that policy for every caller,
 * `contacts_merged_is_archived_check` means a merged row always carries a
 * non-null `deleted_at`), so `getWorkspaceContact` can never see
 * `merged_into_id` on the row this is meant to resolve. This calls the
 * `SECURITY DEFINER` RPC that exists for exactly that hole. `callRpc`, not
 * `supabase.rpc`, because the function is new enough that the generated types
 * do not know it yet.
 */
export async function resolveMergedContact({
  workspaceId,
  contactId,
}: {
  workspaceId: string
  contactId: string
}): Promise<string | null> {
  return callRpc(
    'resolve_merged_contact',
    { p_workspace_id: workspaceId, p_contact_id: contactId },
    z.string().nullable(),
  )
}

/**
 * A row in the Archived filter. `ContactListItem` plus the two things only the
 * archive view has to say: when it was hidden, and how much comes back with it.
 */
export type ArchivedContact = ContactListItem & {
  deleted_at: string
  conversation_count: number
  /**
   * Non-null when the row was merged rather than archived. Such a row is not
   * restorable — `restore_contact` refuses it — so the view shows where it went
   * instead of a button that errors.
   */
  merged_into_id: string | null
  merged_into_name: string | null
}

export type ArchivedContactPage = {
  items: Array<ArchivedContact>
  totalCount: number
}

/**
 * Archiving is an RPC rather than an update of `deleted_at`, and not by
 * preference. The migration put `deleted_at is null` into the contacts UPDATE
 * policy's WITH CHECK — so a member cannot forge an archive with a direct write
 * — and into its SELECT policy, so the row leaves the caller's own view the
 * moment it is stamped and a `.select()` on the way back would find nothing.
 *
 * Conversations are not passed or touched here: `trg_cascade_contact_archive`
 * carries `deleted_at` to them inside the same transaction.
 */
export async function archiveContact(contactId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_contact', {
    p_contact_id: contactId,
  })

  if (error) throw error
}

export async function restoreContact(contactId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_contact', {
    p_contact_id: contactId,
  })

  if (error) throw error
}

/**
 * The archive listing. Owner/admin only — the RPC raises 42501 otherwise — and
 * the single route through the SELECT policy that hides archived rows from
 * every ordinary query.
 */
export async function listArchivedContacts({
  workspaceId,
  query,
  page,
  pageSize = CONTACTS_PAGE_SIZE,
}: {
  workspaceId: string
  query: string
  page: number
  pageSize?: number
}): Promise<ArchivedContactPage> {
  const { data, error } = await supabase.rpc('list_archived_contacts', {
    p_workspace_id: workspaceId,
    p_query: query.trim() || undefined,
    p_limit: pageSize,
    p_offset: Math.max(page - 1, 0) * pageSize,
  })

  if (error) throw error

  // Same cast as searchWorkspaceContacts, for the same reason: the generated
  // Returns type marks every column of a RETURNS TABLE non-nullable.
  const items = data as unknown as Array<ArchivedContact>

  return { items, totalCount: items[0]?.total_count ?? 0 }
}

export type ContactWritePayload = {
  name: string | null
  phone: string | null
  email: string | null
  status: string
  tags: Array<string>
  ownerId: string | null
}

const savedContactSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  avatar_url: z.string().nullable(),
  status: z.string(),
  source: z.string().nullable(),
  tags: z.array(z.string()),
  owner_id: z.string().nullable(),
  last_seen_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  merged_into_id: z.string().nullable(),
  merged_at: z.string().nullable(),
  merged_by: z.string().nullable(),
  contact_channels: z.array(
    z.object({
      id: z.string(),
      channel_type: z.string(),
      external_id: z.string(),
      external_name: z.string().nullable(),
      channel_id: z.string().nullable(),
    }),
  ),
})

export async function createContact({
  workspaceId,
  payload,
  phones,
}: {
  workspaceId: string
  payload: ContactWritePayload
  phones?: Array<string>
}): Promise<ContactDetail> {
  return saveContact({ workspaceId, patch: payload, phones })
}

export async function updateContact({
  workspaceId,
  contactId,
  patch,
  phones,
}: {
  workspaceId: string
  contactId: string
  patch: Partial<ContactWritePayload>
  phones?: Array<string>
}): Promise<ContactDetail> {
  return saveContact({ workspaceId, contactId, patch, phones })
}

function saveContact({
  workspaceId,
  contactId,
  patch,
  phones,
}: {
  workspaceId: string
  contactId?: string
  patch: Partial<ContactWritePayload>
  phones?: Array<string>
}): Promise<ContactDetail> {
  // No two-request fallback: a failed phone write must roll back the scalar
  // fields and a new contact, rather than leaving a partial save to retry.
  return callRpc(
    'save_contact',
    {
      p_workspace_id: workspaceId,
      p_contact_id: contactId,
      p_phones: phones,
      p_fields: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.phone !== undefined && { phone: patch.phone }),
        ...(patch.email !== undefined && { email: patch.email }),
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.tags !== undefined && { tags: patch.tags }),
        ...(patch.ownerId !== undefined && { owner_id: patch.ownerId }),
      },
    },
    savedContactSchema,
  )
}
