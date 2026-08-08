import type { ConversationWithRelations } from '@/entities/conversation'
import { describe, expect, it } from 'vitest'
import {
  UNREAD_NOTIFICATIONS_LIMIT,
  buildUnreadNotificationsViewModel,
  capUnreadCount,
  overlayUnreadCounts,
  selectUnreadConversations,
  totalUnreadCount,
} from './unread-notifications'

function conversationFixture(
  id: string,
  overrides: Partial<ConversationWithRelations> = {},
): ConversationWithRelations {
  return {
    id,
    workspace_id: 'w',
    channel_id: 'c',
    contact_id: 'p',
    assigned_to: null,
    status: 'open',
    unread_count: 0,
    last_message_at: '2026-05-15T10:00:00Z',
    last_message_preview: 'Hi there',
    snoozed_until: null,
    external_thread_id: null,
    last_inbound_at: null,
    created_at: '2020-01-01',
    updated_at: '2020-01-01',
    deleted_at: null,
    channel: { id: 'c', type: 'telegram', name: null },
    contact: {
      id: 'p',
      name: 'Alice',
      phone: null,
      avatar_url: null,
      status: 'new',
    },
    ...overrides,
  }
}

describe('overlayUnreadCounts', () => {
  it('returns an empty list when conversations are undefined', () => {
    expect(overlayUnreadCounts(undefined, { a: 3 })).toEqual([])
  })

  it('merges counts by conversation id and defaults missing entries to 0', () => {
    const result = overlayUnreadCounts(
      [conversationFixture('a'), conversationFixture('b')],
      { a: 4 },
    )
    expect(result.map((row) => row.unread_count)).toEqual([4, 0])
  })

  it('clamps negative counts to 0', () => {
    const result = overlayUnreadCounts([conversationFixture('a')], { a: -2 })
    expect(result[0]?.unread_count).toBe(0)
  })
})

describe('selectUnreadConversations', () => {
  it('excludes conversations with unread_count === 0', () => {
    const result = selectUnreadConversations([
      conversationFixture('read', { unread_count: 0 }),
      conversationFixture('unread', { unread_count: 2 }),
    ])
    expect(result.map((row) => row.id)).toEqual(['unread'])
  })

  it('orders by most recent activity and caps at the limit', () => {
    const rows = Array.from({ length: UNREAD_NOTIFICATIONS_LIMIT + 1 }, (_, i) =>
      conversationFixture(`c${i}`, {
        unread_count: 1,
        last_message_at: `2026-05-0${i + 1}T10:00:00Z`,
      }),
    )
    const result = selectUnreadConversations(rows)
    expect(result).toHaveLength(UNREAD_NOTIFICATIONS_LIMIT)
    expect(result[0]?.id).toBe(`c${UNREAD_NOTIFICATIONS_LIMIT}`)
    expect(result.at(-1)?.id).toBe('c1')
  })

  it('sorts conversations without a last message after dated ones', () => {
    const result = selectUnreadConversations([
      conversationFixture('undated', {
        unread_count: 1,
        last_message_at: null,
      }),
      conversationFixture('dated', { unread_count: 1 }),
    ])
    expect(result.map((row) => row.id)).toEqual(['dated', 'undated'])
  })

  it('honors a custom limit', () => {
    const rows = [
      conversationFixture('a', { unread_count: 1 }),
      conversationFixture('b', { unread_count: 1 }),
    ]
    expect(selectUnreadConversations(rows, 1)).toHaveLength(1)
  })
})

describe('totalUnreadCount', () => {
  it('sums unread counts across all conversations', () => {
    const total = totalUnreadCount([
      conversationFixture('a', { unread_count: 3 }),
      conversationFixture('b', { unread_count: 0 }),
      conversationFixture('c', { unread_count: 5 }),
    ])
    expect(total).toBe(8)
  })

  it('ignores negative counts', () => {
    const total = totalUnreadCount([
      conversationFixture('a', { unread_count: -3 }),
      conversationFixture('b', { unread_count: 2 }),
    ])
    expect(total).toBe(2)
  })
})

describe('capUnreadCount', () => {
  it('renders counts up to 99 as-is and caps above', () => {
    expect(capUnreadCount(5)).toBe('5')
    expect(capUnreadCount(99)).toBe('99')
    expect(capUnreadCount(100)).toBe('99+')
  })
})

describe('buildUnreadNotificationsViewModel', () => {
  it('caps the item list but totals every unread message', () => {
    const conversations = Array.from({ length: 8 }, (_, i) =>
      conversationFixture(`c${i}`, {
        last_message_at: `2026-05-0${i + 1}T10:00:00Z`,
      }),
    )
    const counts = Object.fromEntries(
      conversations.map((row) => [row.id, 10]),
    )
    const { items, totalUnread } = buildUnreadNotificationsViewModel(
      conversations,
      counts,
    )
    expect(items).toHaveLength(UNREAD_NOTIFICATIONS_LIMIT)
    expect(totalUnread).toBe(80)
  })

  it('returns an empty view model while data is loading', () => {
    expect(buildUnreadNotificationsViewModel(undefined, undefined)).toEqual({
      items: [],
      totalUnread: 0,
    })
  })
})
