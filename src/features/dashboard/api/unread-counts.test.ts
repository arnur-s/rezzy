import { mockQueryBuilder, postgrestError } from '@/test/supabase-query-mock'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getUnreadCountsForWorkspaces } from './unread-counts'

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('@/utils/supabase', () => ({
  supabase: supabaseMock,
}))

describe('getUnreadCountsForWorkspaces', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset()
  })

  it('returns an empty map without calling the RPC when there are no workspaces', async () => {
    const result = await getUnreadCountsForWorkspaces([])

    expect(result).toEqual(new Map())
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it('maps per-conversation unread rows keyed by conversation id', async () => {
    supabaseMock.rpc.mockReturnValue(
      mockQueryBuilder([
        { conversation_id: 'c1', unread_count: 2 },
        { conversation_id: 'c2', unread_count: 10 },
      ]),
    )

    const result = await getUnreadCountsForWorkspaces(['w1', 'w2'])

    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'get_unread_counts_for_workspaces',
      { p_workspace_ids: ['w1', 'w2'] },
    )
    expect(result).toEqual(
      new Map([
        ['c1', 2],
        ['c2', 10],
      ]),
    )
  })

  it('throws when the RPC returns an error', async () => {
    const error = postgrestError('rpc failed')
    supabaseMock.rpc.mockReturnValue(mockQueryBuilder(null, error))

    await expect(getUnreadCountsForWorkspaces(['w1'])).rejects.toBe(error)
  })

  it('retains unread conversations past the REST response cap', async () => {
    const rows = Array.from({ length: 1205 }, (_, i) => ({
      conversation_id: `c${i}`,
      unread_count: 1,
    }))
    supabaseMock.rpc.mockImplementation(() =>
      mockQueryBuilder((calls) => {
        const range = calls.find(([name]) => name === 'range')
        const from = Number(range?.[1] ?? 0)
        const to = Number(range?.[2] ?? 999)
        return rows.slice(from, Math.min(to + 1, from + 1000))
      }),
    )
    const counts = await getUnreadCountsForWorkspaces(['w1'])
    expect(counts.size).toBe(1205)
    expect(counts.get('c1204')).toBe(1)
  })
})
