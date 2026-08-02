import type { Tables } from '@/api/types'

export type ContactRow = Tables<'contacts'>

export const CONTACT_STATUSES = ['new', 'in_progress', 'done', 'lost'] as const
export type ContactStatus = (typeof CONTACT_STATUSES)[number]

export function isContactStatus(value: unknown): value is ContactStatus {
  return (
    typeof value === 'string' &&
    (CONTACT_STATUSES as ReadonlyArray<string>).includes(value)
  )
}

export const CONTACT_SOURCES = [
  'whatsapp',
  'instagram',
  'telegram',
  'email',
  'manual',
] as const
export type ContactSource = (typeof CONTACT_SOURCES)[number]

export function isContactSource(value: unknown): value is ContactSource {
  return (
    typeof value === 'string' &&
    (CONTACT_SOURCES as ReadonlyArray<string>).includes(value)
  )
}

export const CONTACT_SORTS = [
  'recent_interaction',
  'recently_added',
  'recently_updated',
  'name_asc',
  'name_desc',
] as const
export type ContactSort = (typeof CONTACT_SORTS)[number]

export function isContactSort(value: unknown): value is ContactSort {
  return (
    typeof value === 'string' &&
    (CONTACT_SORTS as ReadonlyArray<string>).includes(value)
  )
}

export type ContactChannelSummary = {
  id: string
  channel_type: string
  external_id: string
  external_name: string | null
  channel_id: string | null
}

export type ContactWithChannels = ContactRow & {
  contact_channels: Array<{
    id: string
    channel_type: string
    external_name: string | null
  }>
}

export type ContactDetail = ContactRow & {
  contact_channels: Array<ContactChannelSummary>
}

/**
 * One row of `search_workspace_contacts`.
 *
 * Hand-written rather than taken from the generated
 * `Database['public']['Functions'][…]['Returns']`: Postgres `RETURNS TABLE`
 * columns carry no null information, so supabase-js generates every one of them
 * as non-nullable — `name: string` for a column that is null on any contact
 * created from an inbound message. Trusting that type would scatter `.trim()`
 * calls over nulls and still typecheck clean. These are the real nullabilities,
 * taken from the columns the function selects.
 */
export type ContactListItem = {
  id: string
  workspace_id: string
  name: string | null
  /**
   * What the row shows and what name sorts ordered by: the trimmed name, else
   * the earliest channel handle, else null. Computed in SQL so the directory
   * cannot print one string while having sorted by another.
   */
  display_name: string | null
  phone: string | null
  email: string | null
  avatar_url: string | null
  status: string
  source: string | null
  tags: Array<string>
  owner_id: string | null
  last_seen_at: string | null
  created_at: string
  updated_at: string
  channel_types: Array<string>
  total_count: number
}
