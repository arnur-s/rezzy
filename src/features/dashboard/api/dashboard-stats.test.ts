import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDashboardStats } from './dashboard-stats'

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

function terminalIn(rows: Array<unknown>) {
  const inFn = vi.fn().mockResolvedValue({ data: rows, error: null })
  const select = vi.fn().mockReturnValue({ in: inFn })
  return { select }
}

describe('getDashboardStats', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset()
    unreadMock.getUnreadCountsForWorkspaces.mockReset()
  })

  it('sums per-workspace unread from the per-agent read cursor, not a shared column', async () => {
    const conversations = [
      { id: 'c1', workspace_id: 'w1', status: 'open', last_message_at: null },
      { id: 'c2', workspace_id: 'w1', status: 'open', last_message_at: null },
      { id: 'c3', workspace_id: 'w1', status: 'closed', last_message_at: null },
    ]
    const channels = [{ workspace_id: 'w1', type: 'whatsapp' }]
    const contacts = [{ workspace_id: 'w1' }, { workspace_id: 'w1' }]

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'conversations') return terminalIn(conversations)
      if (table === 'channels') return terminalIn(channels)
      if (table === 'contacts') return terminalIn(contacts)
      throw new Error(`Unexpected table: ${table}`)
    })
    // c1 has 2 unread, c3 has 10 unread for this agent; c2 is read (absent).
    unreadMock.getUnreadCountsForWorkspaces.mockResolvedValue(
      new Map([
        ['c1', 2],
        ['c3', 10],
      ]),
    )

    const result = await getDashboardStats(['w1'])

    expect(unreadMock.getUnreadCountsForWorkspaces).toHaveBeenCalledWith(['w1'])

    const w1 = result.perWorkspace.find((entry) => entry.workspaceId === 'w1')
    expect(w1?.unread).toBe(12)
    expect(w1?.open).toBe(2)
    expect(result.aggregate.unread).toBe(12)
  })
})
