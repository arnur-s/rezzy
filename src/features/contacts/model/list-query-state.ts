/**
 * The slice of a TanStack `UseQueryResult` a list view actually reads.
 *
 * Deliberately narrower than the real query type: `DirectoryView` and
 * `ArchivedView` receive their query as a prop from `ContactsPage` (which owns
 * the hook, because the page header also reads it — see the comment there),
 * and a five-field structural type is both a truer description of what the
 * view depends on and trivial to construct in a test, unlike the opaque real
 * `UseQueryResult` union.
 */
export type ListQueryState<T> = {
  data: T | undefined
  isPending: boolean
  isError: boolean
  isRefetching: boolean
  refetch: () => unknown
}
