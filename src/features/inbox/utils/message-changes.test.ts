import type { MessageRow } from '@/entities/message'
import { describe, expect, it } from 'vitest'
import {
  diffMessageLists,
  isInterruptingMessage,
  isOwnOutboundMessage,
  mergePendingMessageIds,
} from './message-changes'

function message({
  id,
  direction = 'inbound',
  createdAt = '2026-05-15T08:00:00Z',
  senderId = null,
  status = 'sent',
}: {
  id: string
  direction?: 'inbound' | 'outbound'
  createdAt?: string
  senderId?: string | null
  status?: string
}): MessageRow {
  return {
    id,
    conversation_id: 'conversation-1',
    workspace_id: 'workspace-1',
    sender_id: senderId,
    direction,
    type: 'text',
    status,
    content: id,
    media_url: null,
    media_filename: null,
    media_mime_type: null,
    media_size: null,
    metadata: {},
    external_id: null,
    reply_to_message_id: null,
    external_reply_to_id: null,
    edited_at: null,
    deleted_at: null,
    provider_timestamp: null,
    created_at: createdAt,
  }
}

describe('diffMessageLists', () => {
  const base = [message({ id: 'a' }), message({ id: 'b' }), message({ id: 'c' })]

  it('identifies a true append by stable id', () => {
    const next = [...base, message({ id: 'd' })]
    expect(diffMessageLists(base, next)).toEqual({
      prepended: [],
      appended: [next[3]],
    })
  })

  it('distinguishes prepend from append', () => {
    const older = [message({ id: 'x' }), message({ id: 'y' })]
    const next = [...older, ...base]
    expect(diffMessageLists(base, next)).toEqual({
      prepended: older,
      appended: [],
    })
  })

  it('classifies simultaneous prepend and append correctly', () => {
    const older = message({ id: 'x' })
    const newer = message({ id: 'd' })
    const next = [older, ...base, newer]
    expect(diffMessageLists(base, next)).toEqual({
      prepended: [older],
      appended: [newer],
    })
  })

  it('ignores status-only updates', () => {
    const next = base.map((row) =>
      row.id === 'c' ? { ...row, status: 'delivered' } : row,
    )
    expect(diffMessageLists(base, next)).toEqual({
      prepended: [],
      appended: [],
    })
  })

  it('ignores same-id optimistic confirmation (row replaced in place)', () => {
    const optimistic = message({ id: 'temp-1', direction: 'outbound' })
    const confirmed = {
      ...optimistic,
      status: 'delivered',
      external_id: 'ext-1',
    }
    const prev = [...base, optimistic]
    const next = [...base, confirmed]
    expect(diffMessageLists(prev, next)).toEqual({
      prepended: [],
      appended: [],
    })
  })

  it('ignores duplicate realtime delivery of a known id', () => {
    // Cache dedup keeps the array identical in content; even if re-created,
    // ids match so nothing is reported.
    const next = base.map((row) => ({ ...row }))
    expect(diffMessageLists(base, next)).toEqual({
      prepended: [],
      appended: [],
    })
  })

  it('treats a new row inserted between survivors (out-of-order realtime) as appended', () => {
    const inserted = message({ id: 'between' })
    const next = [base[0], base[1], inserted, base[2]]
    expect(diffMessageLists(base, next)).toEqual({
      prepended: [],
      appended: [inserted],
    })
  })

  it('handles equal timestamps by id, not position', () => {
    const twin = message({ id: 'twin', createdAt: base[2].created_at })
    const next = [...base, twin]
    expect(diffMessageLists(base, next).appended).toEqual([twin])
  })

  it('reports nothing when a row is removed (optimistic rollback)', () => {
    const next = base.slice(0, 2)
    expect(diffMessageLists(base, next)).toEqual({
      prepended: [],
      appended: [],
    })
  })

  it('reports nothing on wholesale cache replacement', () => {
    const next = [message({ id: 'z1' }), message({ id: 'z2' })]
    expect(diffMessageLists(base, next)).toEqual({
      prepended: [],
      appended: [],
    })
  })

  it('treats growth from empty as appended (first optimistic message)', () => {
    const first = message({ id: 'first', direction: 'outbound' })
    expect(diffMessageLists([], [first])).toEqual({
      prepended: [],
      appended: [first],
    })
  })
})

describe('isOwnOutboundMessage', () => {
  it('matches outbound from the current user', () => {
    expect(
      isOwnOutboundMessage(
        message({ id: 'm', direction: 'outbound', senderId: 'user-1' }),
        'user-1',
      ),
    ).toBe(true)
  })

  it('rejects outbound from another agent', () => {
    expect(
      isOwnOutboundMessage(
        message({ id: 'm', direction: 'outbound', senderId: 'user-2' }),
        'user-1',
      ),
    ).toBe(false)
  })

  it('rejects inbound messages', () => {
    expect(
      isOwnOutboundMessage(message({ id: 'm', direction: 'inbound' }), 'user-1'),
    ).toBe(false)
  })

  it('counts sender-less outbound as own (system-sent on behalf of user)', () => {
    expect(
      isOwnOutboundMessage(
        message({ id: 'm', direction: 'outbound', senderId: null }),
        'user-1',
      ),
    ).toBe(true)
  })

  it('counts any outbound as own when the current user id is unknown', () => {
    expect(
      isOwnOutboundMessage(
        message({ id: 'm', direction: 'outbound', senderId: 'user-2' }),
        null,
      ),
    ).toBe(true)
  })
})

describe('isInterruptingMessage', () => {
  it('counts inbound messages', () => {
    expect(
      isInterruptingMessage(message({ id: 'm', direction: 'inbound' }), 'user-1'),
    ).toBe(true)
  })

  it('counts outbound from a different workspace agent', () => {
    expect(
      isInterruptingMessage(
        message({ id: 'm', direction: 'outbound', senderId: 'user-2' }),
        'user-1',
      ),
    ).toBe(true)
  })

  it('does not count the current user’s own outbound', () => {
    expect(
      isInterruptingMessage(
        message({ id: 'm', direction: 'outbound', senderId: 'user-1' }),
        'user-1',
      ),
    ).toBe(false)
  })
})

describe('mergePendingMessageIds', () => {
  it('appends new unique ids', () => {
    expect(mergePendingMessageIds(['a'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('never counts an id twice', () => {
    expect(mergePendingMessageIds(['a', 'b'], ['b', 'c', 'c'])).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('returns the same reference when nothing new arrives (no re-render)', () => {
    const pending = ['a', 'b']
    expect(mergePendingMessageIds(pending, ['a', 'b'])).toBe(pending)
  })
})
