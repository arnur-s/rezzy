import type { ContactSort, ContactStatus } from '@/entities/contact'

/** Kept in step with the RPC's own clamp: least(greatest(p_limit, 1), 100). */
export const CONTACTS_PAGE_SIZE = 25

export const DEFAULT_CONTACT_SORT: ContactSort = 'recent_interaction'

/**
 * The directory's list state, as it travels from the URL to the query key to
 * the RPC. `page` is 1-based because it is user-visible in the URL; the RPC
 * takes an offset, converted at the API boundary.
 */
export type ContactListParams = {
  query: string
  statuses: Array<ContactStatus>
  tags: Array<string>
  ownerIds: Array<string>
  includeUnowned: boolean
  sort: ContactSort
  page: number
}

/**
 * What the page can ask the URL to change.
 *
 * `archived` is not part of `ContactListParams` because that type maps field
 * for field onto `search_workspace_contacts`, and the archive is served by a
 * different RPC with a different visibility rule. Folding it in would put a
 * parameter into the directory query that the directory query has no argument
 * for.
 */
export type ContactListPatch = Partial<ContactListParams> & {
  archived?: boolean
}

export const EMPTY_CONTACT_LIST_PARAMS: ContactListParams = {
  query: '',
  statuses: [],
  tags: [],
  ownerIds: [],
  includeUnowned: false,
  sort: DEFAULT_CONTACT_SORT,
  page: 1,
}

/** True when anything narrows the list, which decides which empty state to show. */
export function hasActiveContactFilters(params: ContactListParams): boolean {
  return (
    params.query.trim().length > 0 ||
    params.statuses.length > 0 ||
    params.tags.length > 0 ||
    params.ownerIds.length > 0 ||
    params.includeUnowned
  )
}
