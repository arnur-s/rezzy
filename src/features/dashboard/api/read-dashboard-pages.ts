/** Below the Data API's configured max_rows; larger requested limits are capped. */
const PAGE_SIZE = 500

/** Every caller orders by a unique key so ranges cannot overlap on tied dates. */
export async function readDashboardPages<TRow>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: Array<TRow> | null
    error: unknown
  }>,
): Promise<Array<TRow>> {
  const rows: Array<TRow> = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}
