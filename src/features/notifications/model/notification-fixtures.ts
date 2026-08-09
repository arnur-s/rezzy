import type { MessageNotificationDetails } from './types'

/**
 * A complete, valid `MessageNotificationDetails` for tests.
 *
 * Lives in `model/` rather than inside one `.test.ts` so the group-store and
 * component suites share a single typed factory. Building the real shape
 * rather than casting keeps the fixtures honest when the type changes.
 */
export function buildMessageNotificationDetails(
  overrides: Partial<MessageNotificationDetails> = {},
): MessageNotificationDetails {
  // Relative to "now", so `formatRelativeShort` renders a stable, digit-free
  // label and cannot collide with assertions on the group chip's numeral.
  const now = new Date().toISOString()
  return {
    id: 'n1',
    workspaceId: 'w1',
    conversationId: 'c1',
    messageId: 'm1',
    createdAt: now,
    message: {
      id: 'm1',
      type: 'text',
      content: 'Hello, I still need help with my order',
      metadata: {},
      media_filename: null,
      media_mime_type: null,
      created_at: now,
      direction: 'inbound',
    },
    conversation: {
      id: 'c1',
      workspace_id: 'w1',
      channel_id: 'ch1',
      contact_id: 'ct1',
      assigned_to: null,
      status: 'open',
      unread_count: 0,
      last_message_at: now,
      last_message_preview: null,
      snoozed_until: null,
      external_thread_id: null,
      last_inbound_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      channel: { id: 'ch1', type: 'telegram', name: 'Support' },
      contact: {
        id: 'ct1',
        name: 'Maria',
        phone: null,
        avatar_url: null,
        status: 'active',
      },
    },
    ...overrides,
  }
}
