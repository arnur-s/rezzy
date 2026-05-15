import type { MessageRow } from '@/entities/message'
import { describe, expect, it } from 'vitest'
import {
  getFirstUnreadInboundMessageId,
  getInitialScrollTarget,
} from './read-cursor'

function message({
  id,
  direction,
  createdAt,
  senderId = null,
}: {
  id: string
  direction: 'inbound' | 'outbound'
  createdAt: string
  senderId?: string | null
}): MessageRow {
  return {
    id,
    conversation_id: 'conversation-1',
    workspace_id: 'workspace-1',
    sender_id: senderId,
    direction,
    type: 'text',
    status: 'sent',
    content: id,
    media_url: null,
    media_filename: null,
    media_mime_type: null,
    media_size: null,
    metadata: {},
    external_id: null,
    created_at: createdAt,
  }
}

const messages = [
  message({
    id: 'read-inbound',
    direction: 'inbound',
    createdAt: '2026-05-15T08:00:00Z',
  }),
  message({
    id: 'read-outbound',
    direction: 'outbound',
    createdAt: '2026-05-15T08:01:00Z',
  }),
  message({
    id: 'first-unread',
    direction: 'inbound',
    createdAt: '2026-05-15T08:02:00Z',
  }),
  message({
    id: 'latest',
    direction: 'outbound',
    createdAt: '2026-05-15T08:03:00Z',
  }),
]

describe('getInitialScrollTarget', () => {
  it('targets the latest message id when messages exist', () => {
    expect(getInitialScrollTarget({ messages })).toEqual({
      messageId: 'latest',
      reason: 'latest',
    })
  })

  it('returns null message id for an empty thread', () => {
    expect(getInitialScrollTarget({ messages: [] })).toEqual({
      messageId: null,
      reason: 'latest',
    })
  })
})

describe('getFirstUnreadInboundMessageId', () => {
  it('returns first inbound after read cursor when unreadCount > 0', () => {
    expect(
      getFirstUnreadInboundMessageId({
        messages,
        lastReadMessageId: 'read-outbound',
        lastReadAt: null,
        unreadCount: 2,
      }),
    ).toBe('first-unread')
  })

  it('returns null when unreadCount is 0 even if inbound exists after cursor', () => {
    expect(
      getFirstUnreadInboundMessageId({
        messages,
        lastReadMessageId: 'read-outbound',
        lastReadAt: null,
        unreadCount: 0,
      }),
    ).toBeNull()
  })

  it('uses tail heuristic when no cursor id and unreadCount > 0', () => {
    const rows = [
      message({
        id: 'old-inbound',
        direction: 'inbound',
        createdAt: '2026-05-15T08:00:00Z',
      }),
      message({
        id: 'reply-out',
        direction: 'outbound',
        createdAt: '2026-05-15T08:01:00Z',
      }),
      message({
        id: 'only-unread-in',
        direction: 'inbound',
        createdAt: '2026-05-15T08:02:00Z',
      }),
    ]
    expect(
      getFirstUnreadInboundMessageId({
        messages: rows,
        lastReadMessageId: null,
        lastReadAt: null,
        unreadCount: 1,
      }),
    ).toBe('only-unread-in')
  })

  it('returns null when no cursor and unreadCount is 0', () => {
    expect(
      getFirstUnreadInboundMessageId({
        messages,
        lastReadMessageId: null,
        lastReadAt: null,
        unreadCount: 0,
      }),
    ).toBeNull()
  })

  it('uses tail when cursor message is missing and unreadCount > 0', () => {
    const rows = [
      message({
        id: 'old-inbound',
        direction: 'inbound',
        createdAt: '2026-05-15T08:00:00Z',
      }),
      message({
        id: 'reply-out',
        direction: 'outbound',
        createdAt: '2026-05-15T08:01:00Z',
      }),
      message({
        id: 'only-unread-in',
        direction: 'inbound',
        createdAt: '2026-05-15T08:02:00Z',
      }),
    ]
    expect(
      getFirstUnreadInboundMessageId({
        messages: rows,
        lastReadMessageId: 'deleted-message',
        lastReadAt: null,
        unreadCount: 1,
      }),
    ).toBe('only-unread-in')
  })

  it('returns null for empty messages', () => {
    expect(
      getFirstUnreadInboundMessageId({
        messages: [],
        lastReadMessageId: 'x',
        lastReadAt: null,
        unreadCount: 1,
      }),
    ).toBeNull()
  })

  it('returns only inbound after cursor (skips outbound)', () => {
    const rows = [
      message({
        id: 'last-read',
        direction: 'inbound',
        createdAt: '2026-05-15T08:00:00Z',
      }),
      message({
        id: 'outbound-after-cursor',
        direction: 'outbound',
        createdAt: '2026-05-15T08:01:00Z',
      }),
      message({
        id: 'first-unread',
        direction: 'inbound',
        createdAt: '2026-05-15T08:02:00Z',
      }),
    ]

    expect(
      getFirstUnreadInboundMessageId({
        messages: rows,
        lastReadMessageId: 'last-read',
        lastReadAt: null,
        unreadCount: 1,
      }),
    ).toBe('first-unread')
  })

  it('returns null when only outbound after cursor with unreadCount > 0', () => {
    const rows = [
      message({
        id: 'last-read',
        direction: 'inbound',
        createdAt: '2026-05-15T08:00:00Z',
      }),
      message({
        id: 'outbound-after-cursor',
        direction: 'outbound',
        createdAt: '2026-05-15T08:01:00Z',
      }),
    ]

    expect(
      getFirstUnreadInboundMessageId({
        messages: rows,
        lastReadMessageId: 'last-read',
        lastReadAt: null,
        unreadCount: 1,
      }),
    ).toBeNull()
  })

  it('uses first inbound after lastReadAt when cursor id is absent from list', () => {
    const rows = [
      message({
        id: 'a',
        direction: 'inbound',
        createdAt: '2026-05-15T08:00:00Z',
      }),
      message({
        id: 'b',
        direction: 'inbound',
        createdAt: '2026-05-15T08:05:00Z',
      }),
    ]

    expect(
      getFirstUnreadInboundMessageId({
        messages: rows,
        lastReadMessageId: 'missing',
        lastReadAt: '2026-05-15T08:03:00Z',
        unreadCount: 0,
      }),
    ).toBe('b')
  })

  it('does not return outbound-only tail when unread heuristic would be stale', () => {
    const rows = [
      message({
        id: 'old-inbound',
        direction: 'inbound',
        createdAt: '2026-05-15T08:00:00Z',
      }),
      message({
        id: 'my-reply',
        direction: 'outbound',
        createdAt: '2026-05-15T09:00:00Z',
        senderId: 'user-1',
      }),
    ]

    expect(
      getFirstUnreadInboundMessageId({
        messages: rows,
        lastReadMessageId: null,
        lastReadAt: null,
        unreadCount: 1,
      }),
    ).toBeNull()
  })

  it('own outbound messages never appear as divider id (inbound-only)', () => {
    expect(
      getFirstUnreadInboundMessageId({
        messages,
        lastReadMessageId: 'read-inbound',
        lastReadAt: null,
        unreadCount: 3,
      }),
    ).toBe('first-unread')
    expect(
      getFirstUnreadInboundMessageId({
        messages,
        lastReadMessageId: null,
        lastReadAt: null,
        unreadCount: 99,
      }),
    ).not.toBe('latest')
  })
})
