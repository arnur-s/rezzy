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
    supabaseMock.rpc.mockResolvedValue({
      data: [
        { conversation_id: 'c1', unread_count: 2 },
        { conversation_id: 'c2', unread_count: 10 },
      ],
      error: null,
    })

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
    const error = new Error('rpc failed')
    supabaseMock.rpc.mockResolvedValue({ data: null, error })

    await expect(getUnreadCountsForWorkspaces(['w1'])).rejects.toBe(error)
  })
})
