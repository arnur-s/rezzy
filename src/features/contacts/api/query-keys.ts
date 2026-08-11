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
  /**
   * The Archived filter's own cache, a sibling of `lists` rather than a page of
   * it. They are served by different RPCs with different visibility rules, so
   * `lists(workspaceId)` must not match archived pages: archiving invalidates
   * the live directory, and a prefix that swept up both would refetch an
   * admin-only listing on behalf of members who cannot read it.
   */
  archived: (workspaceId: string) =>
    [...contactQueryKeys.workspace(workspaceId), 'archived'] as const,
  archivedList: (workspaceId: string, query: string, page: number) =>
    [
      ...contactQueryKeys.archived(workspaceId),
      { query: query.trim().toLowerCase(), page },
    ] as const,
  /**
   * The duplicates view's own cache, a sibling of `lists` for the same reason
   * `archived` is: a different RPC with a different shape. A directory edit
   * should not refetch a workspace-wide group-by, and a merge invalidates both
   * explicitly rather than relying on one prefix to sweep up the other.
   */
  duplicates: (workspaceId: string) =>
    [...contactQueryKeys.workspace(workspaceId), 'duplicates'] as const,
  duplicatesPage: (workspaceId: string, page: number) =>
    [...contactQueryKeys.duplicates(workspaceId), { page }] as const,
  details: (workspaceId: string) =>
    [...contactQueryKeys.workspace(workspaceId), 'detail'] as const,
  detail: (workspaceId: string, contactId: string) =>
    [...contactQueryKeys.details(workspaceId), contactId] as const,
  conversations: (workspaceId: string, contactId: string) =>
    [
      ...contactQueryKeys.detail(workspaceId, contactId),
      'conversations',
    ] as const,
  conversationCount: (workspaceId: string, contactId: string) =>
    [
      ...contactQueryKeys.detail(workspaceId, contactId),
      'conversation-count',
    ] as const,
  phones: (workspaceId: string, contactId: string) =>
    [...contactQueryKeys.detail(workspaceId, contactId), 'phones'] as const,
  /** What a merge would move off this contact, for the confirmation step. */
  mergeChildren: (workspaceId: string, contactId: string) =>
    [
      ...contactQueryKeys.detail(workspaceId, contactId),
      'merge-children',
    ] as const,
  /**
   * Whether this id, unreadable through `detail` because it is merged, has a
   * survivor to redirect to. A sibling of `detail`, not a field on it — the
   * detail page only asks this once `detail` has come back null, never
   * alongside it.
   */
  mergedRedirect: (workspaceId: string, contactId: string) =>
    [
      ...contactQueryKeys.detail(workspaceId, contactId),
      'merged-redirect',
    ] as const,
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
