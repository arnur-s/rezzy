import type { ContactListParams } from '../model/contact-list-params'

/**
 * TanStack hashes keys with a stable stringify that sorts object keys but not
 * array elements, so ['a','b'] and ['b','a'] would otherwise be two cache
 * entries for one result. Normalised once, here.
 */
function serializeParams(params: ContactListParams) {
  return {
    query: params.query.trim().toLowerCase(),
    statuses: [...params.statuses].sort(),
    tags: [...params.tags].sort(),
    ownerIds: [...params.ownerIds].sort(),
    includeUnowned: params.includeUnowned,
    sort: params.sort,
    page: params.page,
  }
}

/**
 * The workspace segment comes before the shape segment, unlike
 * `contactNoteQueryKeys` (`['contact-notes','list',ws,contactId]`), because
 * contacts have several shapes per workspace and every patch and invalidation
 * in this feature is scoped to one workspace.
 *
 * That ordering is what makes `lists(workspaceId)` a usable prefix: it matches
 * every page and filter combination of one workspace's directory and nothing
 * else. With the notes ordering you would either over-invalidate across
 * workspaces — dropping workspace B's cached pages because workspace A changed —
 * or need a predicate function to avoid it.
 */
export const contactQueryKeys = {
  all: ['contacts'] as const,
  workspace: (workspaceId: string) =>
    [...contactQueryKeys.all, workspaceId] as const,
  lists: (workspaceId: string) =>
    [...contactQueryKeys.workspace(workspaceId), 'list'] as const,
  list: (workspaceId: string, params: ContactListParams) =>
    [...contactQueryKeys.lists(workspaceId), serializeParams(params)] as const,
  details: (workspaceId: string) =>
    [...contactQueryKeys.workspace(workspaceId), 'detail'] as const,
  detail: (workspaceId: string, contactId: string) =>
    [...contactQueryKeys.details(workspaceId), contactId] as const,
  conversations: (workspaceId: string, contactId: string) =>
    [
      ...contactQueryKeys.detail(workspaceId, contactId),
      'conversations',
    ] as const,
  phones: (workspaceId: string, contactId: string) =>
    [...contactQueryKeys.detail(workspaceId, contactId), 'phones'] as const,
  /**
   * Identity lookups ("is this shared contact already in the CRM?"). Under the
   * workspace segment like everything else, so creating a contact invalidates
   * every open lookup in that workspace and none in another.
   */
  matches: (workspaceId: string) =>
    [...contactQueryKeys.workspace(workspaceId), 'match'] as const,
  match: (workspaceId: string, identityKey: string) =>
    [...contactQueryKeys.matches(workspaceId), identityKey] as const,
}
