import type { MessageRow } from '@/entities/message'
import { describe, expect, it } from 'vitest'
import { getInitialScrollTarget } from './read-cursor'

function message({
  id,
  direction,
  createdAt,
}: {
  id: string
  direction: 'inbound' | 'outbound'
  createdAt: string
}): MessageRow {
  return {
    id,
    conversation_id: 'conversation-1',
    workspace_id: 'workspace-1',
    sender_id: null,
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
  it('uses the first inbound message after the read cursor when unread messages exist', () => {
    expect(
      getInitialScrollTarget({
        messages,
        lastReadMessageId: 'read-outbound',
        unreadCount: 2,
      }),
    ).toEqual({ messageId: 'first-unread', reason: 'first-unread' })
  })

  it('uses the last read cursor when there are no unread messages', () => {
    expect(
      getInitialScrollTarget({
        messages,
        lastReadMessageId: 'read-outbound',
        unreadCount: 0,
      }),
    ).toEqual({ messageId: 'read-outbound', reason: 'last-read' })
  })

  it('uses the first message from the unread inbound tail when no cursor exists', () => {
    expect(
      getInitialScrollTarget({
        messages,
        lastReadMessageId: null,
        unreadCount: 1,
      }),
    ).toEqual({ messageId: 'first-unread', reason: 'first-unread' })
  })

  it('uses the latest message when no cursor and no unread messages exist', () => {
    expect(
      getInitialScrollTarget({
        messages,
        lastReadMessageId: null,
        unreadCount: 0,
      }),
    ).toEqual({ messageId: 'latest', reason: 'latest' })
  })

  it('uses the unread inbound tail when the cursor message is missing', () => {
    expect(
      getInitialScrollTarget({
        messages,
        lastReadMessageId: 'deleted-message',
        unreadCount: 1,
      }),
    ).toEqual({ messageId: 'first-unread', reason: 'first-unread' })
  })

  it('returns a null latest target for an empty thread', () => {
    expect(
      getInitialScrollTarget({
        messages: [],
        lastReadMessageId: 'read-outbound',
        unreadCount: 1,
      }),
    ).toEqual({ messageId: null, reason: 'latest' })
  })
})
