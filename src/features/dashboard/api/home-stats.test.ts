import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHomeStats } from './home-stats'

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}))
const unreadMock = vi.hoisted(() => ({
  getUnreadCountsForWorkspaces: vi.fn(),
}))

vi.mock('@/utils/supabase', () => ({ supabase: supabaseMock }))
vi.mock('./unread-counts', () => ({
  getUnreadCountsForWorkspaces: unreadMock.getUnreadCountsForWorkspaces,
}))

type ConversationRow = {
  id: string
  status: string
  snoozed_until: string | null
  last_message_at: string | null
}

function mockConversations(rows: Array<ConversationRow>) {
  const inFn = vi.fn().mockResolvedValue({ data: rows, error: null })
  const eq = vi.fn().mockReturnValue({ in: inFn })
  const select = vi.fn().mockReturnValue({ eq })
  supabaseMock.from.mockReturnValue({ select })
}

const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString()

describe('getHomeStats', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset()
    unreadMock.getUnreadCountsForWorkspaces.mockReset()
  })

  it('returns zeros without querying when there are no workspaces', async () => {
    const result = await getHomeStats('user-1', [])

    expect(result).toEqual({
      unreadAssigned: 0,
      openAssigned: 0,
      snoozedWaking: 0,
      staleAssigned: 0,
    })
    expect(supabaseMock.from).not.toHaveBeenCalled()
    expect(unreadMock.getUnreadCountsForWorkspaces).not.toHaveBeenCalled()
  })

  it('counts unread from the per-agent read cursor, not a shared column', async () => {
    mockConversations([
      { id: 'c1', status: 'open', snoozed_until: null, last_message_at: recent },
      { id: 'c2', status: 'open', snoozed_until: null, last_message_at: recent },
      { id: 'c3', status: 'open', snoozed_until: null, last_message_at: recent },
    ])
    // Only c1 is unread for this agent; c2/c3 are read (absent from the map).
    unreadMock.getUnreadCountsForWorkspaces.mockResolvedValue(
      new Map([['c1', 3]]),
    )

    const result = await getHomeStats('user-1', ['w1'])

    expect(unreadMock.getUnreadCountsForWorkspaces).toHaveBeenCalledWith(['w1'])
    expect(result.openAssigned).toBe(3)
    expect(result.unreadAssigned).toBe(1)
  })
})
