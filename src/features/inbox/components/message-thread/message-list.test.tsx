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
}: {
  id: string
  direction: 'inbound' | 'outbound'
  createdAt: string
}): MessageRow {
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

describe('MessageList unread behavior', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('renders the unread divider and marks read when the read anchor becomes visible', async () => {
    const observerState: {
      callback?: IntersectionObserverCallback
      observer?: IntersectionObserver
    } = {}

    vi.stubGlobal(
      'IntersectionObserver',
      class TestIntersectionObserver implements IntersectionObserver {
        readonly root = null
        readonly rootMargin = ''
        readonly scrollMargin = ''
        readonly thresholds = []

        constructor(cb: IntersectionObserverCallback) {
          observerState.callback = cb
          observerState.observer = this
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords(): Array<IntersectionObserverEntry> {
          return []
        }
      },
    )

    const onReadAnchorVisible = vi.fn()

    render(
      <MessageList
        conversationId="conversation-1"
        messages={baseMessages}
        isLoading={false}
        isError={false}
        contactName="Customer"
        initialScrollTarget={{
          messageId: 'first-unread',
          reason: 'first-unread',
        }}
        unreadDividerMessageId="first-unread"
        readAnchorMessageId="first-unread"
        markReadMessageId="latest"
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    expect(
      screen.getByText(
        /Unread messages|\u041d\u0435\u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f/u,
      ),
    ).toBeTruthy()

    await waitFor(() => expect(observerState.callback).toBeDefined())

    observerState.callback!(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      observerState.observer!,
    )

    expect(onReadAnchorVisible).toHaveBeenCalledWith('latest')
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
        initialScrollTarget={{ messageId: 'first-unread', reason: 'latest' }}
        unreadDividerMessageId={null}
        readAnchorMessageId={null}
        markReadMessageId={null}
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
        initialScrollTarget={{ messageId: 'first-unread', reason: 'latest' }}
        unreadDividerMessageId={null}
        readAnchorMessageId={null}
        markReadMessageId={null}
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    expect(
      screen.getByText(
        /New messages|\u041d\u043e\u0432\u044b\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f/u,
      ),
    ).toBeTruthy()
  })
})
