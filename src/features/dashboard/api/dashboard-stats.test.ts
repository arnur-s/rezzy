import { mockQueryBuilder } from '@/test/supabase-query-mock'
import type { QueryBuilderMock } from '@/test/supabase-query-mock'
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

const queries = new Map<string, QueryBuilderMock<Array<unknown>>>()

/** Routes each table to its own recording builder. */
function mockTables(tables: Record<string, Array<unknown>>) {
  queries.clear()
  for (const [table, rows] of Object.entries(tables)) {
    queries.set(table, mockQueryBuilder(rows))
  }
  supabaseMock.from.mockImplementation((table: string) => {
    const query = queries.get(table)
    if (!query) throw new Error(`Unexpected table: ${table}`)
    return query
  })
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

    mockTables({ conversations, channels, contacts })
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

  it('bounds every table read so a large workspace cannot silently truncate', async () => {
    mockTables({ conversations: [], channels: [], contacts: [] })
    unreadMock.getUnreadCountsForWorkspaces.mockResolvedValue(new Map())

    await getDashboardStats(['w1'])

    for (const [table, query] of queries) {
      const limit = query.argsFor('limit')?.[0]
      expect({ table, isNumber: typeof limit === 'number' }).toEqual({
        table,
        isNumber: true,
      })
      expect(limit).toBeGreaterThan(1000)
    }
  })

  it('reuses a shared unread map instead of fetching its own', async () => {
    mockTables({ conversations: [], channels: [], contacts: [] })
    const shared = Promise.resolve(new Map<string, number>())

    await getDashboardStats(['w1'], shared)

    expect(unreadMock.getUnreadCountsForWorkspaces).not.toHaveBeenCalled()
  })
})
