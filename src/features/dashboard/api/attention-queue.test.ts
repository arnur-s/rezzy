import { mockQueryBuilder } from '@/test/supabase-query-mock'
import type { QueryBuilderMock } from '@/test/supabase-query-mock'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAttentionQueue, getUnassignedQueue } from './attention-queue'

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

let lastQuery: QueryBuilderMock<Array<unknown>>

function mockConversations(rows: Array<unknown>, count: number | null = null) {
  lastQuery = mockQueryBuilder(rows, null, count)
  supabaseMock.from.mockReturnValue(lastQuery)
}

const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString()

function conversation(id: string) {
  return {
    id,
    workspace_id: 'w1',
    contact_id: `contact-${id}`,
    status: 'open',
    last_message_at: recent,
    last_message_preview: 'Latest customer message',
    snoozed_until: null,
    channel: { id: 'ch1', type: 'whatsapp', name: 'Sales WhatsApp' },
    contact: { id: `contact-${id}`, name: 'Jane Doe', avatar_url: null },
  }
}

describe('getAttentionQueue', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset()
    unreadMock.getUnreadCountsForWorkspaces.mockReset()
  })

  it('flags unread items from the per-agent read cursor, not a shared column', async () => {
    // c1 is unread for this agent; c2 is read (absent from the map) and recent,
    // so it should not appear at all.
    mockConversations([conversation('c1'), conversation('c2')])
    unreadMock.getUnreadCountsForWorkspaces.mockResolvedValue(
      new Map([['c1', 4]]),
    )

    const result = await getAttentionQueue('user-1', ['w1'])

    expect(unreadMock.getUnreadCountsForWorkspaces).toHaveBeenCalledWith(['w1'])
    expect(result.items).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.items[0].conversationId).toBe('c1')
    expect(result.items[0].reason).toBe('unread')
    expect(result.items[0].preview).toBe('Latest customer message')
  })

  it('surfaces the longest-waiting stale thread first, not the newest', async () => {
    const days = (n: number) =>
      new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
    mockConversations([
      { ...conversation('fresh-stale'), last_message_at: days(3) },
      { ...conversation('old-stale'), last_message_at: days(70) },
    ])
    unreadMock.getUnreadCountsForWorkspaces.mockResolvedValue(new Map())

    const result = await getAttentionQueue('user-1', ['w1'])

    expect(result.items.map((i) => i.conversationId)).toEqual([
      'old-stale',
      'fresh-stale',
    ])
    expect(result.items.every((i) => i.reason === 'stale')).toBe(true)
  })

  it('asks only for live conversations, newest first, under a row ceiling', async () => {
    // Closed threads can never qualify for an attention reason, and Supabase
    // truncates at max_rows silently. Ordering means that if the ceiling is
    // ever reached, what survives is the live edge rather than a random slice.
    mockConversations([])
    unreadMock.getUnreadCountsForWorkspaces.mockResolvedValue(new Map())

    await getAttentionQueue('user-1', ['w1'])

    expect(lastQuery.calls.filter(([name]) => name === 'in')).toContainEqual([
      'in',
      'status',
      ['open', 'snoozed'],
    ])
    expect(lastQuery.argsFor('order')?.[0]).toBe('last_message_at')
    const limit = lastQuery.argsFor('limit')?.[0]
    expect(typeof limit).toBe('number')
    expect(limit).toBeGreaterThan(1000)
  })

  it('reuses a shared unread map instead of fetching its own', async () => {
    mockConversations([])
    const shared = Promise.resolve(new Map<string, number>())

    await getAttentionQueue('user-1', ['w1'], shared)

    expect(unreadMock.getUnreadCountsForWorkspaces).not.toHaveBeenCalled()
  })
})

describe('getUnassignedQueue', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset()
  })

  // The count is quoted as a fact in the home summary ("nothing is waiting on
  // you, but N are unclaimed"), so returning the page length would state the
  // display cap with false precision the moment the real number exceeded it.
  it('reports the true total, not the capped page length', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => conversation(`u${i}`))
    mockConversations(rows, 23)

    const result = await getUnassignedQueue(['w1'])

    expect(result.items).toHaveLength(5)
    expect(result.total).toBe(23)
  })

  it('falls back to the page length when the server omits the count', async () => {
    mockConversations([conversation('u1')], null)

    const result = await getUnassignedQueue(['w1'])

    // Never an overstatement: at worst it undercounts, which cannot turn the
    // summary into a false claim of calm.
    expect(result.total).toBe(1)
  })

  it('asks for an exact count rather than deriving one from the page', async () => {
    mockConversations([], 0)
    await getUnassignedQueue(['w1'])

    const selectArgs = lastQuery.argsFor('select')
    expect(selectArgs?.[1]).toMatchObject({ count: 'exact' })
  })

  it('returns an empty queue without querying when there are no workspaces', async () => {
    const result = await getUnassignedQueue([])
    expect(result).toEqual({ items: [], total: 0 })
    expect(supabaseMock.from).not.toHaveBeenCalled()
  })
})
