import { describe, expect, it, vi } from 'vitest'
import { readDashboardPages } from './read-dashboard-pages'

describe('dashboard paging', () => {
  it('reads beyond the Data API row cap without missing the final partial page', async () => {
    const rows = Array.from({ length: 1205 }, (_, id) => ({ id }))
    const fetchPage = vi.fn((from: number, to: number) =>
      Promise.resolve({
        data: rows.slice(from, Math.min(to + 1, from + 1000)),
        error: null,
      }),
    )
    expect(await readDashboardPages(fetchPage)).toEqual(rows)
    expect(fetchPage.mock.calls).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ])
  })

  it('checks for another page at an exact boundary', async () => {
    const rows = Array.from({ length: 500 }, (_, id) => id)
    const fetchPage = vi.fn((from: number, to: number) =>
      Promise.resolve({
        data: rows.slice(from, to + 1),
        error: null,
      }),
    )
    expect(await readDashboardPages(fetchPage)).toEqual(rows)
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('rejects a failed later page instead of presenting partial counts as exact', async () => {
    const error = new Error('permission removed during paging')
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: Array.from({ length: 500 }, (_, i) => i),
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error })
    await expect(readDashboardPages(fetchPage)).rejects.toBe(error)
  })

  it('handles an empty workspace', async () => {
    expect(
      await readDashboardPages(() =>
        Promise.resolve({ data: [], error: null }),
      ),
    ).toEqual([])
  })
})
