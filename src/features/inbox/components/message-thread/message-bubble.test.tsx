import type { MessageReactionRow, MessageRow } from '@/entities/message'
import { setLocale } from '@/paraglide/runtime'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQueryClient } from '@/test/render'
import { MessageBubble } from './message-bubble'
import {
  
  MessageThreadProvider
} from './message-thread-context'
import type {MessageThreadContextValue} from './message-thread-context';

vi.mock('./message-media', () => ({
  MessageMediaAttachment: ({ mediaUrl }: { mediaUrl: string | null }) => (
    <div data-testid="media-attachment">{mediaUrl}</div>
  ),
}))

function messageRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'msg-1',
    conversation_id: 'conversation-1',
    workspace_id: 'workspace-1',
    sender_id: null,
    direction: 'inbound',
    type: 'text',
    status: 'delivered',
    content: 'hello',
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
    created_at: '2026-07-23T10:00:00Z',
    ...overrides,
  }
}

function reactionRow(overrides: Partial<MessageReactionRow> = {}): MessageReactionRow {
  return {
    id: 'reaction-1',
    workspace_id: 'workspace-1',
    channel_id: 'channel-1',
    conversation_id: 'conversation-1',
    message_id: 'msg-1',
    provider_message_id: '100',
    reactor_external_id: '555',
    is_from_contact: true,
    emoji: '👍',
    action: 'added',
    provider_timestamp: null,
    metadata: {},
    created_at: '2026-07-23T10:01:00Z',
    updated_at: '2026-07-23T10:01:00Z',
    ...overrides,
  }
}

function renderBubble(
  message: MessageRow,
  thread?: Partial<MessageThreadContextValue>,
  props?: { closesRun?: boolean; isTabStop?: boolean },
) {
  const value: MessageThreadContextValue = {
    channelType: 'telegram',
    contactName: 'Alina',
    reactionsByMessageId: new Map(),
    messagesById: new Map(),
    onReplyToMessage: null,
    ...thread,
  }
  return renderWithQueryClient(
    <MessageThreadProvider value={value}>
      <MessageBubble message={message} {...props} />
    </MessageThreadProvider>,
  )
}

beforeEach(() => {
  setLocale('en', { reload: false })
})

describe('MessageBubble structured types', () => {
  it('renders locations with a map link', () => {
    renderBubble(
      messageRow({
        type: 'location',
        content: null,
        metadata: {
          location: { kind: 'venue', latitude: 51.1, longitude: 71.4, name: 'Coffee Boom', address: 'Turan 37' },
        },
      }),
    )
    expect(screen.getByText('Coffee Boom')).toBeTruthy()
    expect(screen.getByText('Turan 37')).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      'https://maps.google.com/?q=51.1,71.4',
    )
  })

  it('renders contact cards with phone numbers', () => {
    renderBubble(
      messageRow({
        type: 'contact',
        content: null,
        metadata: {
          contacts: [{ name: 'Dana A', phones: [{ wa_id: '77015550001' }] }],
        },
      }),
    )
    expect(screen.getByText('Dana A')).toBeTruthy()
    expect(screen.getByText('+77015550001')).toBeTruthy()
  })

  it('renders interactive replies with their selection context', () => {
    renderBubble(
      messageRow({
        type: 'interactive',
        content: 'Plan B',
        metadata: {
          interactive: { kind: 'list_reply', id: 'row2', title: 'Plan B', description: 'Second option' },
        },
      }),
    )
    expect(screen.getByText('List selection')).toBeTruthy()
    expect(screen.getByText('Plan B')).toBeTruthy()
    expect(screen.getByText('Second option')).toBeTruthy()
  })

  it('renders an explicit unsupported fallback, never an empty bubble', () => {
    renderBubble(
      messageRow({
        type: 'unsupported',
        content: null,
        metadata: { unsupported: { kind: 'poll', preview: 'Lunch?' } },
      }),
    )
    expect(
      screen.getByText("This message type isn't supported yet"),
    ).toBeTruthy()
    expect(screen.getByText('Lunch?')).toBeTruthy()
  })

  it('renders shares with a link and story replies with a label', () => {
    renderBubble(
      messageRow({
        type: 'share',
        content: null,
        metadata: { share: { kind: 'ig_reel', url: 'https://cdn/reel', title: 'A reel' } },
      }),
    )
    expect(screen.getByText('Shared reel')).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://cdn/reel')
  })
})

describe('MessageBubble reply, edit, delete, reactions', () => {
  it('shows a compact quoted reply preview', () => {
    renderBubble(
      messageRow({
        reply_to_message_id: 'parent-1',
        metadata: {
          quote: { external_id: '55', preview: 'original text', author_name: 'Aizhan K' },
        },
      }),
    )
    expect(screen.getByText('Aizhan K')).toBeTruthy()
    expect(screen.getByText('original text')).toBeTruthy()
  })

  it('marks edited messages', () => {
    renderBubble(messageRow({ edited_at: '2026-07-23T10:05:00Z' }))
    expect(screen.getByText('edited')).toBeTruthy()
  })

  it('hides deleted content behind a placeholder', () => {
    renderBubble(
      messageRow({ content: 'secret text', deleted_at: '2026-07-23T10:06:00Z' }),
    )
    expect(screen.getByText('This message was deleted')).toBeTruthy()
    expect(screen.queryByText('secret text')).toBeNull()
  })

  it('renders grouped reactions under the bubble', () => {
    renderBubble(messageRow(), {
      reactionsByMessageId: new Map([
        [
          'msg-1',
          [
            reactionRow(),
            reactionRow({ id: 'reaction-2', reactor_external_id: '556' }),
            reactionRow({ id: 'reaction-3', emoji: '❤️' }),
          ],
        ],
      ]),
    })
    expect(screen.getByText('👍')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('❤️')).toBeTruthy()
  })

  it('offers retry for failed outbound messages', () => {
    renderBubble(
      messageRow({ direction: 'outbound', status: 'failed', sender_id: 'user-1' }),
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    // Failure is stated in words, not left to a status glyph.
    expect(screen.getByText('Not sent')).toBeTruthy()
  })

  it('leaves the quoted author unstated rather than labelling it', () => {
    renderBubble(
      messageRow({
        reply_to_message_id: 'parent-1',
        metadata: { quote: { external_id: '55', preview: 'original text' } },
      }),
    )
    expect(screen.getByText('original text')).toBeTruthy()
    expect(screen.queryByText('Quoted message')).toBeNull()
  })

  it('quotes the loaded parent when the reply carries no quote payload', () => {
    const parent = messageRow({ id: 'parent-1', content: 'Can you resend it?' })
    renderBubble(
      messageRow({ id: 'msg-2', reply_to_message_id: 'parent-1' }),
      { messagesById: new Map([[parent.id, parent]]), contactName: 'Alina' },
    )
    expect(screen.getByText('Can you resend it?')).toBeTruthy()
    expect(screen.getByText('Alina')).toBeTruthy()
    expect(screen.queryByText('Quoted message')).toBeNull()
  })

  it('attributes a quoted outbound parent to the operator, not the contact', () => {
    const parent = messageRow({
      id: 'parent-1',
      direction: 'outbound',
      content: 'Invoice is on its way',
    })
    renderBubble(
      messageRow({ id: 'msg-2', reply_to_message_id: 'parent-1' }),
      { messagesById: new Map([[parent.id, parent]]), contactName: 'Alina' },
    )
    expect(screen.getByText('You')).toBeTruthy()
    expect(screen.queryByText('Alina')).toBeNull()
  })

  it('inerts the quote strip when the parent is not loaded', () => {
    renderBubble(
      messageRow({
        reply_to_message_id: 'parent-1',
        metadata: { quote: { external_id: '55', preview: 'original text' } },
      }),
    )
    const strip = screen.getByText('original text').closest('button')
    expect(strip?.hasAttribute('disabled')).toBe(true)
  })
})

describe('MessageBubble run footers and reply affordance', () => {
  const replyThread = { onReplyToMessage: vi.fn() }

  it('shows one timestamp per run instead of one per bubble', () => {
    const message = messageRow()
    const closing = renderBubble(message, undefined, { closesRun: true })
    // Read the rendered time back so the assertion holds in any timezone.
    const stamp = screen.getByText(/^\d{1,2}:\d{2}\s?(AM|PM)?$/i).textContent
    expect(stamp).toBeTruthy()
    closing.unmount()

    renderBubble(message, undefined, { closesRun: false })
    expect(screen.queryByText(stamp)).toBeNull()
  })

  it('keeps the footer mid-run when the message carries its own state', () => {
    renderBubble(
      messageRow({ direction: 'outbound', status: 'failed', sender_id: 'user-1' }),
      undefined,
      { closesRun: false },
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('exposes exactly one sequential tab stop per transcript', () => {
    const { unmount } = renderBubble(messageRow(), replyThread, {
      isTabStop: true,
    })
    expect(screen.getByRole('button', { name: 'Reply' }).tabIndex).toBe(0)
    unmount()

    renderBubble(messageRow(), replyThread, { isTabStop: false })
    // Still focusable by the arrow keys, just not by Tab.
    expect(screen.getByRole('button', { name: 'Reply' }).tabIndex).toBe(-1)
  })

  it('replies with the message the rail belongs to', () => {
    const onReplyToMessage = vi.fn()
    const message = messageRow({ id: 'msg-42' })
    renderBubble(message, { onReplyToMessage })
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    expect(onReplyToMessage).toHaveBeenCalledWith(message)
  })

  it('offers no reply control on a deleted message', () => {
    renderBubble(
      messageRow({ deleted_at: '2026-07-23T10:06:00Z' }),
      { onReplyToMessage: vi.fn() },
    )
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull()
  })

  it('renders extra structured attachments beyond the legacy first one', () => {
    const message = {
      ...messageRow({ type: 'image', content: null, media_url: 'ws/c/m/one.jpg' }),
      message_attachments: [
        {
          id: 'att-2',
          workspace_id: 'workspace-1',
          message_id: 'msg-1',
          position: 1,
          kind: 'image',
          provider_media_id: null,
          provider_media_unique_id: null,
          storage_bucket: 'chat-media',
          storage_path: 'ws/c/m/two.jpg',
          thumbnail_path: null,
          filename: 'two.jpg',
          mime_type: 'image/jpeg',
          size_bytes: 100,
          width: null,
          height: null,
          duration_seconds: null,
          checksum: null,
          download_status: 'stored',
          failure_reason: null,
          metadata: {},
          created_at: '2026-07-23T10:00:00Z',
        },
      ],
    }
    renderBubble(message)
    const attachments = screen.getAllByTestId('media-attachment')
    expect(attachments).toHaveLength(2)
    expect(attachments[1].textContent).toBe('ws/c/m/two.jpg')
  })
})
