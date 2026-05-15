import { describe, expect, it } from 'vitest'
import type { ConversationWithRelations } from '../model/types'
import { sortConversationsByActivity } from './conversation-sort'

function row(
  id: string,
  last: string | null,
): ConversationWithRelations {
  return {
    id,
    workspace_id: 'w',
    channel_id: 'c',
    contact_id: 'p',
    assigned_to: null,
    status: 'open',
    unread_count: 0,
    last_message_at: last,
    last_message_preview: null,
    snoozed_until: null,
    created_at: '2020-01-01',
    updated_at: '2020-01-01',
    channel: { id: 'c', type: 'telegram', name: null },
    contact: {
      id: 'p',
      name: 'A',
      phone: null,
      avatar_url: null,
      status: 'new',
    },
    assigned_profile: null,
  }
}

describe('sortConversationsByActivity', () => {
  it('orders by last_message_at descending, nulls last', () => {
    const a = row('1', '2026-05-01T10:00:00Z')
    const b = row('2', '2026-05-02T10:00:00Z')
    const c = row('3', null)
    const sorted = sortConversationsByActivity([a, c, b])
    expect(sorted.map((r) => r.id)).toEqual(['2', '1', '3'])
  })
})
