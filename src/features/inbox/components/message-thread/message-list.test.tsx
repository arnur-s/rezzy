import type { MessageRow } from '@/entities/message'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageList } from './message-list'

vi.mock('./message-bubble', () => ({
  MessageBubble: ({ message: row }: { message: MessageRow }) => (
    <div id={`message-${row.id}`} data-message-id={row.id}>
      {row.content}
    </div>
  ),
}))

function messageRow({
  id,
  direction,
  createdAt,
  senderId = null,
}: {
  id: string
  direction: 'inbound' | 'outbound'
  createdAt: string
  senderId?: string | null
}): MessageRow {
  return {
    id,
    conversation_id: 'conversation-1',
    workspace_id: 'workspace-1',
    sender_id: senderId,
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
    created_at: createdAt,
  }
}

const baseMessages = [
  messageRow({
    id: 'read',
    direction: 'outbound',
    createdAt: '2026-05-15T08:00:00Z',
  }),
  messageRow({
    id: 'first-unread',
    direction: 'inbound',
    createdAt: '2026-05-15T08:01:00Z',
  }),
  messageRow({
    id: 'latest',
    direction: 'inbound',
    createdAt: '2026-05-15T08:02:00Z',
  }),
]

function mockNearBottomScroll(el: HTMLElement) {
  Object.defineProperties(el, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 400 },
    scrollTop: { configurable: true, value: 520 },
  })
}

describe('MessageList unread behavior', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('renders the unread divider and marks read only after scroll reports near bottom with unreads', async () => {
    const onReadAnchorVisible = vi.fn()

    const { container } = render(
      <MessageList
        conversationId="conversation-1"
        messages={baseMessages}
        isLoading={false}
        isError={false}
        contactName="Customer"
        currentUserId={null}
        initialScrollTarget={{
          messageId: 'latest',
          reason: 'latest',
        }}
        unreadDividerMessageId="first-unread"
        hasUnreadInboundMessages
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    expect(
      screen.getByText(
        /Unread messages|Непрочитанные сообщения/u,
      ),
    ).toBeTruthy()

    await waitFor(() =>
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        block: 'center',
      }),
    )

    const scrollNode = container.querySelector('.overflow-y-auto')
    if (!(scrollNode instanceof HTMLElement)) {
      throw new Error('Scroll container was not rendered')
    }

    mockNearBottomScroll(scrollNode)
    fireEvent.scroll(scrollNode)

    await waitFor(() =>
      expect(onReadAnchorVisible).toHaveBeenCalledWith('latest'),
    )
  })

  it('does not call onReadAnchorVisible twice for the same latest id at bottom', async () => {
    const onReadAnchorVisible = vi.fn()

    const { container } = render(
      <MessageList
        conversationId="conversation-1"
        messages={baseMessages}
        isLoading={false}
        isError={false}
        contactName="Customer"
        currentUserId={null}
        initialScrollTarget={{
          messageId: 'latest',
          reason: 'latest',
        }}
        unreadDividerMessageId="first-unread"
        hasUnreadInboundMessages
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    const scrollNode = container.querySelector('.overflow-y-auto')
    if (!(scrollNode instanceof HTMLElement)) {
      throw new Error('Scroll container was not rendered')
    }

    mockNearBottomScroll(scrollNode)
    fireEvent.scroll(scrollNode)
    fireEvent.scroll(scrollNode)

    await waitFor(() => expect(onReadAnchorVisible).toHaveBeenCalledTimes(1))
  })

  it('does not mark read when inbound arrives while scrolled up with unreads until bottom', async () => {
    const onReadAnchorVisible = vi.fn()
    const { container, rerender } = render(
      <MessageList
        conversationId="conversation-1"
        messages={baseMessages}
        isLoading={false}
        isError={false}
        contactName="Customer"
        currentUserId={null}
        initialScrollTarget={{ messageId: 'latest', reason: 'latest' }}
        unreadDividerMessageId="first-unread"
        hasUnreadInboundMessages
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    const scrollNode = container.querySelector('.overflow-y-auto')
    if (!(scrollNode instanceof HTMLElement)) {
      throw new Error('Scroll container was not rendered')
    }

    Object.defineProperties(scrollNode, {
      scrollHeight: { configurable: true, value: 1200 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 100 },
    })
    fireEvent.scroll(scrollNode)
    onReadAnchorVisible.mockClear()

    rerender(
      <MessageList
        conversationId="conversation-1"
        messages={[
          ...baseMessages,
          messageRow({
            id: 'new-inbound',
            direction: 'inbound',
            createdAt: '2026-05-15T08:03:00Z',
          }),
        ]}
        isLoading={false}
        isError={false}
        contactName="Customer"
        currentUserId={null}
        initialScrollTarget={{ messageId: 'latest', reason: 'latest' }}
        unreadDividerMessageId="first-unread"
        hasUnreadInboundMessages
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    expect(onReadAnchorVisible).not.toHaveBeenCalled()

    mockNearBottomScroll(scrollNode)
    fireEvent.scroll(scrollNode)

    await waitFor(() =>
      expect(onReadAnchorVisible).toHaveBeenCalledWith('new-inbound'),
    )
  })

  it('shows the new messages button for inbound realtime messages while away from bottom', () => {
    const onReadAnchorVisible = vi.fn()
    const { container, rerender } = render(
      <MessageList
        conversationId="conversation-1"
        messages={baseMessages.slice(0, 2)}
        isLoading={false}
        isError={false}
        contactName="Customer"
        currentUserId={null}
        initialScrollTarget={{ messageId: 'first-unread', reason: 'latest' }}
        unreadDividerMessageId={null}
        hasUnreadInboundMessages={false}
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    const scrollNode = container.querySelector('.overflow-y-auto')
    if (!(scrollNode instanceof HTMLElement)) {
      throw new Error('Scroll container was not rendered')
    }

    Object.defineProperties(scrollNode, {
      scrollHeight: { configurable: true, value: 1200 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 100 },
    })

    fireEvent.scroll(scrollNode)

    rerender(
      <MessageList
        conversationId="conversation-1"
        messages={[
          ...baseMessages.slice(0, 2),
          messageRow({
            id: 'new-inbound',
            direction: 'inbound',
            createdAt: '2026-05-15T08:03:00Z',
          }),
        ]}
        isLoading={false}
        isError={false}
        contactName="Customer"
        currentUserId={null}
        initialScrollTarget={{ messageId: 'first-unread', reason: 'latest' }}
        unreadDividerMessageId={null}
        hasUnreadInboundMessages={false}
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    expect(
      screen.getByText(
        /New messages|1 new message|Новые сообщения|новое сообщение/u,
      ),
    ).toBeTruthy()
  })

  it('increments the new message count for each inbound arrival while away from bottom', () => {
    const onReadAnchorVisible = vi.fn()
    const { container, rerender } = render(
      <MessageList
        conversationId="conversation-1"
        messages={baseMessages.slice(0, 1)}
        isLoading={false}
        isError={false}
        contactName="Customer"
        currentUserId={null}
        initialScrollTarget={{ messageId: 'read', reason: 'latest' }}
        unreadDividerMessageId={null}
        hasUnreadInboundMessages={false}
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    const scrollNode = container.querySelector('.overflow-y-auto')
    if (!(scrollNode instanceof HTMLElement)) {
      throw new Error('Scroll container was not rendered')
    }

    Object.defineProperties(scrollNode, {
      scrollHeight: { configurable: true, value: 1200 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 0 },
    })
    fireEvent.scroll(scrollNode)

    rerender(
      <MessageList
        conversationId="conversation-1"
        messages={[
          ...baseMessages.slice(0, 1),
          messageRow({
            id: 'inbound-1',
            direction: 'inbound',
            createdAt: '2026-05-15T08:01:00Z',
          }),
        ]}
        isLoading={false}
        isError={false}
        contactName="Customer"
        currentUserId={null}
        initialScrollTarget={{ messageId: 'read', reason: 'latest' }}
        unreadDividerMessageId={null}
        hasUnreadInboundMessages={false}
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    rerender(
      <MessageList
        conversationId="conversation-1"
        messages={[
          ...baseMessages.slice(0, 1),
          messageRow({
            id: 'inbound-1',
            direction: 'inbound',
            createdAt: '2026-05-15T08:01:00Z',
          }),
          messageRow({
            id: 'inbound-2',
            direction: 'inbound',
            createdAt: '2026-05-15T08:02:00Z',
          }),
        ]}
        isLoading={false}
        isError={false}
        contactName="Customer"
        currentUserId={null}
        initialScrollTarget={{ messageId: 'read', reason: 'latest' }}
        unreadDividerMessageId={null}
        hasUnreadInboundMessages={false}
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    expect(
      screen.getByText(
        /2 new messages|2 новых/u,
      ),
    ).toBeTruthy()
  })

  it('scrolls to bottom and calls onReadAnchorVisible when own outbound is added while scrolled up and bottom is reached', async () => {
    const onReadAnchorVisible = vi.fn()
    let scrollTopVal = 0

    const { container, rerender } = render(
      <MessageList
        conversationId="conversation-1"
        messages={baseMessages.slice(0, 2)}
        isLoading={false}
        isError={false}
        contactName="Customer"
        currentUserId="user-1"
        initialScrollTarget={{ messageId: 'first-unread', reason: 'latest' }}
        unreadDividerMessageId="first-unread"
        hasUnreadInboundMessages
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    const scrollNode = container.querySelector('.overflow-y-auto')
    if (!(scrollNode instanceof HTMLElement)) {
      throw new Error('Scroll container was not rendered')
    }

    Object.defineProperties(scrollNode, {
      scrollHeight: { configurable: true, value: 1200 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: {
        configurable: true,
        get: () => scrollTopVal,
        set: (v: number) => {
          scrollTopVal = v
        },
      },
    })
    fireEvent.scroll(scrollNode)
    onReadAnchorVisible.mockClear()

    const outboundMsg = messageRow({
      id: 'outbound-sent',
      direction: 'outbound',
      createdAt: '2026-05-15T08:03:00Z',
      senderId: 'user-1',
    })

    rerender(
      <MessageList
        conversationId="conversation-1"
        messages={[...baseMessages.slice(0, 2), outboundMsg]}
        isLoading={false}
        isError={false}
        contactName="Customer"
        currentUserId="user-1"
        initialScrollTarget={{ messageId: 'first-unread', reason: 'latest' }}
        unreadDividerMessageId="first-unread"
        hasUnreadInboundMessages
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    await waitFor(() =>
      expect(onReadAnchorVisible).toHaveBeenCalledWith('outbound-sent'),
    )
  })
})
