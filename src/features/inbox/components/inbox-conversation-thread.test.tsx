import type { ConversationWithRelations } from '@/entities/conversation'
import { setLocale } from '@/paraglide/runtime'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InboxConversationThread } from './inbox-conversation-thread'
import { InboxThreadRouteContextProvider } from './inbox-route-context'

vi.mock('./message-thread/message-thread', () => ({
  MessageThread: ({
    conversation: activeConversation,
    onBack,
    onToggleContactPanel,
  }: {
    conversation: ConversationWithRelations
    onBack: () => void
    onToggleContactPanel: () => void
  }) => (
    <section>
      <h1>Thread {activeConversation.id}</h1>
      <button type="button" onClick={onBack}>
        Back
      </button>
      <button type="button" onClick={onToggleContactPanel}>
        Contact
      </button>
    </section>
  ),
}))

function conversation(id = 'conv-1'): ConversationWithRelations {
  return {
    id,
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
      name: 'Test Contact',
      phone: null,
      avatar_url: null,
      status: 'new',
    },
  }
}

function renderThread({
  selectedConversation = conversation(),
  conversationId = selectedConversation?.id ?? 'missing-conversation',
  isConversationsPending = false,
  isConversationsError = false,
  onBackToList = vi.fn(),
  onToggleContactPanel = vi.fn(),
}: {
  selectedConversation?: ConversationWithRelations | null
  conversationId?: string
  isConversationsPending?: boolean
  isConversationsError?: boolean
  onBackToList?: () => void
  onToggleContactPanel?: () => void
} = {}) {
  render(
    <InboxThreadRouteContextProvider
      value={{
        workspaceId: 'workspace-1',
        senderId: 'user-1',
        selectedConversation,
        selectedConversationId: conversationId,
        isConversationsPending,
        isConversationsError,
        // This suite always opens a specific thread, so the list is never the
        // empty case the flag describes.
        hasNoConversations: false,
        onBackToList,
        onToggleContactPanel,
        scrollToLatestNonce: 0,
      }}
    >
      <InboxConversationThread conversationId={conversationId} />
    </InboxThreadRouteContextProvider>,
  )

  return { onBackToList, onToggleContactPanel }
}

describe('InboxConversationThread', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('renders the selected conversation thread from route context', () => {
    const { onBackToList, onToggleContactPanel } = renderThread()

    expect(screen.getByText('Thread conv-1')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBackToList).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Contact' }))
    expect(onToggleContactPanel).toHaveBeenCalledOnce()
  })

  it('renders an unavailable state for an unknown conversation id', () => {
    const { onBackToList } = renderThread({
      selectedConversation: null,
      conversationId: 'missing-conversation',
    })

    expect(screen.getByText('Conversation unavailable')).toBeTruthy()
    expect(
      screen.getByText(
        'This conversation may have been deleted, moved, or you may no longer have access.',
      ),
    ).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: 'Back to conversations' }),
    )
    expect(onBackToList).toHaveBeenCalledOnce()
  })
})
