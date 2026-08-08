import type { ConversationWithRelations } from '@/entities/conversation'
import { setLocale } from '@/paraglide/runtime'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageThread } from './message-thread'

const AVATAR = 'https://cdn.example.com/contact.png'

// Everything the thread needs to mount, stubbed to its quietest shape. This
// file is about one prop reaching one child, not about loading behaviour.
vi.mock('../../hooks/use-messages', () => ({
  useMessages: () => ({
    // The hook exposes `messages`, not `data`; the thread reads it unguarded.
    messages: [],
    isPending: false,
    isError: false,
    isFetching: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  useConversationReadCursor: () => ({
    data: null,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useMarkConversationReadToMessage: () => ({ mutate: vi.fn() }),
}))

vi.mock('../../hooks/use-messages-realtime', () => ({
  useMessagesRealtime: () => {},
}))

vi.mock('../../hooks/use-reactions', () => ({
  useConversationReactions: () => ({ reactionsByMessageId: new Map() }),
  useReactionsRealtime: () => {},
}))

vi.mock('../../hooks/use-send-reaction', () => ({
  useSendReaction: () => ({
    sendReaction: vi.fn(),
    isMessagePending: () => false,
  }),
}))

vi.mock('./message-composer', () => ({ MessageComposer: () => null }))
vi.mock('./thread-scroll-button', () => ({ ThreadScrollButton: () => null }))
vi.mock('./message-thread-status-actions', () => ({
  MessageThreadStatusActions: () => null,
}))
vi.mock('./conversation-assignee-control', () => ({
  ConversationAssigneeControl: () => null,
}))

// Records what the thread hands down, so a dropped prop is visible even though
// the list itself renders nothing here.
const received: Array<string | undefined> = []

vi.mock('./message-list', () => ({
  MessageList: ({ contactAvatarUrl }: { contactAvatarUrl?: string }) => {
    received.push(contactAvatarUrl)
    return null
  },
}))

function conversation(avatarUrl: string | null): ConversationWithRelations {
  return {
    id: 'conv-1',
    workspace_id: 'workspace-1',
    channel_id: 'channel-1',
    contact_id: 'contact-1',
    assigned_to: null,
    status: 'open',
    unread_count: 0,
    last_message_at: '2026-05-15T10:00:00Z',
    last_message_preview: 'Hi there',
    snoozed_until: null,
    external_thread_id: null,
    last_inbound_at: null,
    created_at: '2026-05-01T10:00:00Z',
    updated_at: '2026-05-01T10:00:00Z',
    deleted_at: null,
    channel: { id: 'channel-1', type: 'telegram', name: null },
    contact: {
      id: 'contact-1',
      name: 'Jane Doe',
      phone: null,
      avatar_url: avatarUrl,
      status: 'new',
    },
  }
}

function renderThread(avatarUrl: string | null) {
  return render(
    <MessageThread
      workspaceId="workspace-1"
      conversation={conversation(avatarUrl)}
      senderId="user-1"
      onToggleContactPanel={() => {}}
    />,
  )
}

/**
 * The contact picture is only ever right if every link in the chain passes it
 * on, and this is the link where it enters: the thread owns the conversation
 * row, the list and transcript merely forward what they are given. Cutting it
 * here broke no test, so the transcript could have kept rendering initials with
 * the whole suite green.
 */
describe('MessageThread contact avatar wiring', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    received.length = 0
  })

  it('hands the conversation contact picture to the message list', () => {
    renderThread(AVATAR)

    expect(received).toContain(AVATAR)
  })

  it('hands down nothing when the contact has no picture', () => {
    renderThread(null)

    expect(received.length).toBeGreaterThan(0)
    expect(received.every((value) => value === undefined)).toBe(true)
  })
})
