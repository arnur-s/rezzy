import type { ContactDetail, ContactListItem } from '@/entities/contact'
import { supabase } from '@/utils/supabase'
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

export type ContactWritePayload = {
  name: string | null
  phone: string | null
  email: string | null
  status: string
  tags: Array<string>
  ownerId: string | null
}

export async function createContact({
  workspaceId,
  payload,
}: {
  workspaceId: string
  payload: ContactWritePayload
}): Promise<ContactDetail> {
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      workspace_id: workspaceId,
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      status: payload.status,
      tags: payload.tags,
      owner_id: payload.ownerId,
      source: 'manual',
    })
    .select(CONTACT_DETAIL_SELECT)
    .single()

  if (error) throw error
  return data
}

export async function updateContact({
  workspaceId,
  contactId,
  patch,
}: {
  workspaceId: string
  contactId: string
  patch: Partial<ContactWritePayload>
}): Promise<ContactDetail> {
  const { data, error } = await supabase
    .from('contacts')
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.phone !== undefined && { phone: patch.phone }),
      ...(patch.email !== undefined && { email: patch.email }),
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.tags !== undefined && { tags: patch.tags }),
      ...(patch.ownerId !== undefined && { owner_id: patch.ownerId }),
    })
    .eq('workspace_id', workspaceId)
    .eq('id', contactId)
    .select(CONTACT_DETAIL_SELECT)
    .single()

  if (error) throw error
  return data
}
