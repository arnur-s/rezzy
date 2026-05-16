import type { MessageRow } from '@/entities/message'
import { describe, expect, it } from 'vitest'
import type { MessagesPageResult } from '../api/messages'
import {
  appendMessageToNewestPage,
  flattenMessagePages,
  getNextPageCursorFromPages,
  getOldestMessageCursor,
} from './message-pages'

function msg(id: string, createdAt: string): MessageRow {
  return {
    id,
    conversation_id: 'c1',
    workspace_id: 'w1',
    sender_id: null,
    direction: 'inbound',
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

describe('flattenMessagePages', () => {
  it('merges pages oldest-to-newest in chronological order', () => {
    const pages: Array<MessagesPageResult> = [
      {
        messages: [msg('3', '2026-05-15T10:00:00Z'), msg('4', '2026-05-15T11:00:00Z')],
        hasMore: false,
      },
      {
        messages: [msg('1', '2026-05-15T08:00:00Z'), msg('2', '2026-05-15T09:00:00Z')],
        hasMore: true,
      },
    ]

    expect(flattenMessagePages(pages).map((m) => m.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])
  })

  it('returns empty array for undefined pages', () => {
    expect(flattenMessagePages(undefined)).toEqual([])
  })
})

describe('getOldestMessageCursor', () => {
  it('uses the first message in chronological list', () => {
    const messages = [
      msg('1', '2026-05-15T08:00:00Z'),
      msg('2', '2026-05-15T09:00:00Z'),
    ]
    expect(getOldestMessageCursor(messages)).toEqual({
      createdAt: '2026-05-15T08:00:00Z',
      id: '1',
    })
  })
})

describe('getNextPageCursorFromPages', () => {
  it('returns cursor from oldest message in last page when hasMore', () => {
    const pages: Array<MessagesPageResult> = [
      { messages: [msg('2', '2026-05-15T09:00:00Z')], hasMore: false },
      { messages: [msg('1', '2026-05-15T08:00:00Z')], hasMore: true },
    ]
    expect(getNextPageCursorFromPages(pages)).toEqual({
      createdAt: '2026-05-15T08:00:00Z',
      id: '1',
    })
  })

  it('returns undefined when last page has no more', () => {
    const pages: Array<MessagesPageResult> = [
      { messages: [msg('1', '2026-05-15T08:00:00Z')], hasMore: false },
    ]
    expect(getNextPageCursorFromPages(pages)).toBeUndefined()
  })
})

describe('appendMessageToNewestPage', () => {
  it('appends to the first page and sorts chronologically', () => {
    const pages: Array<MessagesPageResult> = [
      {
        messages: [msg('1', '2026-05-15T08:00:00Z')],
        hasMore: false,
      },
    ]
    const next = appendMessageToNewestPage(
      pages,
      msg('2', '2026-05-15T09:00:00Z'),
    )
    expect(next[0].messages.map((m) => m.id)).toEqual(['1', '2'])
  })

  it('dedupes by id', () => {
    const pages: Array<MessagesPageResult> = [
      { messages: [msg('1', '2026-05-15T08:00:00Z')], hasMore: false },
    ]
    const next = appendMessageToNewestPage(
      pages,
      msg('1', '2026-05-15T08:00:00Z'),
    )
    expect(next).toBe(pages)
  })
})
