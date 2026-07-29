import type { MessageRow } from '@/entities/message'
import { setLocale } from '@/paraglide/runtime'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageList } from './message-list'

vi.mock('./message-bubble', () => ({
  MessageBubble: ({ message: row }: { message: MessageRow }) => (
    <div data-message-id={row.id}>{row.content}</div>
  ),
}))

const AVATAR = 'https://cdn.example.com/contact.png'

function messageRow(id: string, direction: 'inbound' | 'outbound'): MessageRow {
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
    reply_to_message_id: null,
    external_reply_to_id: null,
    edited_at: null,
    deleted_at: null,
    provider_timestamp: null,
    created_at: '2026-05-15T08:00:00Z',
  }
}

const messages = [
  messageRow('outbound-1', 'outbound'),
  messageRow('inbound-1', 'inbound'),
]

const baseProps = {
  conversationId: 'conversation-1',
  isLoading: false,
  isError: false,
  contactName: 'Customer',
  currentUserId: null,
  unreadDividerMessageId: null,
  hasUnreadInboundMessages: false,
} as const

/**
 * The contact picture is threaded from the conversation row through MessageList
 * and into the transcript, so it is only right if every link in that chain
 * passes it on. Asserted end to end rather than on the transcript alone,
 * because a prop dropped in the middle is exactly the failure worth catching.
 */
describe('MessageList contact avatar', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('gives inbound runs the contact picture', () => {
    render(
      <MessageList
        {...baseProps}
        messages={messages}
        contactAvatarUrl={AVATAR}
        onReadAnchorVisible={vi.fn()}
      />,
    )

    expect(document.querySelector(`img[src="${AVATAR}"]`)).not.toBeNull()
  })

  it('leaves initials in place when the contact has no picture', () => {
    render(
      <MessageList
        {...baseProps}
        messages={messages}
        onReadAnchorVisible={vi.fn()}
      />,
    )

    expect(document.querySelector('img')).toBeNull()
  })
})
