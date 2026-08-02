import type { ChannelType } from '@/entities/channel'
import type { MessageReactionRow, MessageRow } from '@/entities/message'
import { OUTBOUND_REACTOR_ID } from '@/entities/message'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageBubble } from './message-bubble'
import { MessageThreadProvider } from './message-thread-context'
import type { MessageThreadContextValue } from './message-thread-context'

/**
 * Whether the reaction affordance appears at all, decided in the bubble from
 * the channel's capabilities and the message's own state. The rules themselves
 * are pinned in reaction-eligibility.test.ts; this is the wiring — that the
 * bubble asks, and renders what it is told.
 */

vi.mock('./message-media', () => ({
  MessageMediaAttachment: ({ mediaUrl }: { mediaUrl: string | null }) => (
    <div data-testid="media-attachment">{mediaUrl}</div>
  ),
}))

const HEART = String.fromCodePoint(0x2764)
const THUMBS_UP = String.fromCodePoint(0x1f44d)

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
    // Delivered messages carry the provider id a reaction is addressed to.
    external_id: '100',
    reply_to_message_id: null,
    external_reply_to_id: null,
    edited_at: null,
    deleted_at: null,
    provider_timestamp: null,
    created_at: '2026-07-23T10:00:00Z',
    ...overrides,
  }
}

function outboundReaction(emoji: string): MessageReactionRow {
  return {
    id: 'reaction-1',
    workspace_id: 'workspace-1',
    channel_id: 'channel-1',
    conversation_id: 'conversation-1',
    message_id: 'msg-1',
    provider_message_id: '100',
    reactor_external_id: OUTBOUND_REACTOR_ID,
    is_from_contact: false,
    emoji,
    action: 'added',
    provider_timestamp: null,
    metadata: {},
    created_at: '2026-07-23T10:01:00Z',
    updated_at: '2026-07-23T10:01:00Z',
  }
}

function renderBubble({
  message = messageRow(),
  channelType = 'telegram',
  isChannelActive = true,
  onReactToMessage = vi.fn(),
  isReactionPending = () => false,
  reactions = [] as Array<MessageReactionRow>,
}: {
  message?: MessageRow
  channelType?: ChannelType
  isChannelActive?: boolean
  onReactToMessage?: MessageThreadContextValue['onReactToMessage']
  isReactionPending?: (messageId: string) => boolean
  reactions?: Array<MessageReactionRow>
} = {}) {
  const value: MessageThreadContextValue = {
    channelType,
    contactName: 'Alina',
    isChannelActive,
    reactionsByMessageId: new Map(
      reactions.length > 0 ? [[message.id, reactions]] : [],
    ),
    messagesById: new Map(),
    onReplyToMessage: null,
    onReactToMessage,
    isReactionPending,
  }
  return renderWithQueryClient(
    <MessageThreadProvider value={value}>
      <MessageBubble message={message} />
    </MessageThreadProvider>,
  )
}

function reactionTrigger() {
  return (
    screen.queryByRole('button', { name: 'React to message' }) ??
    screen.queryByRole('button', { name: 'Change reaction' })
  )
}

beforeEach(() => {
  setLocale('en', { reload: false })
})

describe('visibility', () => {
  it('offers the action on a provider that supports reactions', () => {
    renderBubble({ channelType: 'telegram' })
    expect(reactionTrigger()).not.toBeNull()
  })

  it('draws nothing on a provider that cannot send reactions', () => {
    // The thread mounts no reaction workflow for email, so the bubble has
    // nothing to offer — not a disabled control the agent cannot act on.
    renderBubble({ channelType: 'email', onReactToMessage: null })
    expect(reactionTrigger()).toBeNull()
  })

  it('draws nothing for a message type that cannot carry a reaction', () => {
    renderBubble({ message: messageRow({ type: 'system' }) })
    expect(reactionTrigger()).toBeNull()
  })
})

describe('disabled states', () => {
  it('disables the action on a deleted message', () => {
    renderBubble({
      message: messageRow({ deleted_at: '2026-07-23T11:00:00Z' }),
    })
    expect(reactionTrigger()?.getAttribute('aria-disabled')).toBe('true')
  })

  it('disables the action while the message has no provider id yet', () => {
    renderBubble({ message: messageRow({ external_id: null }) })
    expect(reactionTrigger()?.getAttribute('aria-disabled')).toBe('true')
  })

  it('disables the action on a disconnected channel', () => {
    renderBubble({ isChannelActive: false })
    expect(reactionTrigger()?.getAttribute('aria-disabled')).toBe('true')
  })

  it('disables the action while this message’s reaction is in flight', () => {
    renderBubble({ isReactionPending: (id) => id === 'msg-1' })
    expect(reactionTrigger()?.getAttribute('aria-disabled')).toBe('true')
  })

  it('leaves other messages reactive while one is in flight', () => {
    // Pending is per-message: a slow provider on one bubble must not freeze
    // the rest of the transcript.
    renderBubble({ isReactionPending: (id) => id === 'some-other-message' })
    expect(reactionTrigger()?.getAttribute('aria-disabled')).not.toBe('true')
  })
})

describe('current reaction', () => {
  it('names the trigger for changing when the workspace already reacted', () => {
    renderBubble({ reactions: [outboundReaction(HEART)] })
    expect(
      screen.getByRole('button', { name: 'Change reaction' }),
    ).not.toBeNull()
  })

  it('passes the picked emoji up with the message it belongs to', () => {
    const onReactToMessage = vi.fn()
    const message = messageRow()
    renderBubble({ message, onReactToMessage })

    fireEvent.click(screen.getByRole('button', { name: 'React to message' }))
    fireEvent.click(
      screen.getByRole('button', { name: `React with ${THUMBS_UP}` }),
    )

    expect(onReactToMessage).toHaveBeenCalledWith(message, THUMBS_UP)
  })
})
