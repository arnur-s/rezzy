import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAttentionQueue } from './attention-queue'

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

function mockConversations(rows: Array<unknown>) {
  const inFn = vi.fn().mockResolvedValue({ data: rows, error: null })
  const eq = vi.fn().mockReturnValue({ in: inFn })
  const select = vi.fn().mockReturnValue({ eq })
  supabaseMock.from.mockReturnValue({ select })
}

const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString()

function conversation(id: string) {
  return {
    id,
    workspace_id: 'w1',
    contact_id: `contact-${id}`,
    status: 'open',
    last_message_at: recent,
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
    expect(result).toHaveLength(1)
    expect(result[0].conversationId).toBe('c1')
    expect(result[0].reason).toBe('unread')
  })
})
