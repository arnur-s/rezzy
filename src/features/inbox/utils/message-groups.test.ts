import type { MessageRow } from '@/entities/message'
import { describe, expect, it } from 'vitest'
import { buildMessageGroups, flattenMessageGroups } from './message-groups'

function message({
  id,
  createdAt,
}: {
  id: string
  createdAt: string
}): MessageRow {
  return {
    id,
    conversation_id: 'conversation-1',
    workspace_id: 'workspace-1',
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
    reply_to_message_id: null,
    external_reply_to_id: null,
    edited_at: null,
    deleted_at: null,
    provider_timestamp: null,
    created_at: createdAt,
  }
}

const messages = [
  message({ id: 'day1-a', createdAt: '2026-05-14T09:00:00Z' }),
  message({ id: 'day1-b', createdAt: '2026-05-14T10:00:00Z' }),
  message({ id: 'day2-a', createdAt: '2026-05-15T08:00:00Z' }),
]

describe('flattenMessageGroups', () => {
  it('flattens groups into heading and message items with stable semantic keys', () => {
    const flat = flattenMessageGroups(buildMessageGroups(messages), null)

    expect(flat.map((item) => item.kind)).toEqual([
      'heading',
      'message',
      'message',
      'heading',
      'message',
    ])
    // Message identity is the message id; heading keys derive from the date.
    expect(flat[1].key).toBe('day1-a')
    expect(flat[0].key).toMatch(/^heading:/)
    expect(flat[0].key).not.toBe(flat[3].key)
  })

  it('inserts the unread divider directly before its message with an id-derived key', () => {
    const flat = flattenMessageGroups(buildMessageGroups(messages), 'day2-a')

    const dividerIndex = flat.findIndex((item) => item.kind === 'divider')
    expect(dividerIndex).toBeGreaterThan(-1)
    expect(flat[dividerIndex].key).toBe('divider:day2-a')
    expect(flat[dividerIndex + 1]).toMatchObject({
      kind: 'message',
      key: 'day2-a',
    })
  })

  it('keys are stable across prepends (identical for the shared suffix)', () => {
    const withoutOlder = flattenMessageGroups(buildMessageGroups(messages), null)
    const older = message({ id: 'day0-a', createdAt: '2026-05-13T12:00:00Z' })
    const withOlder = flattenMessageGroups(
      buildMessageGroups([older, ...messages]),
      null,
    )

    // The prepended day adds items at the front; every existing key survives
    // unchanged so the virtualizer can anchor the viewport by key.
    expect(withOlder.slice(2).map((item) => item.key)).toEqual(
      withoutOlder.map((item) => item.key),
    )
  })

  it('omits the divider when the id is not in the list', () => {
    const flat = flattenMessageGroups(buildMessageGroups(messages), 'missing')
    expect(flat.some((item) => item.kind === 'divider')).toBe(false)
  })
})
