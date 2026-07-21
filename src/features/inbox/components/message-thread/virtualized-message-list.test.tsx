import type { MessageRow } from '@/entities/message'
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VirtualizedMessageList } from './virtualized-message-list'

type VirtualizerOptions = {
  count: number
  initialOffset?: number | (() => number)
}

const virtualizerMock = vi.hoisted(() => ({
  latestOptions: null as VirtualizerOptions | null,
  measureElement: vi.fn(),
  scrollToIndex: vi.fn(),
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: VirtualizerOptions) => {
    virtualizerMock.latestOptions = options

    const initialOffset =
      typeof options.initialOffset === 'function'
        ? options.initialOffset()
        : (options.initialOffset ?? 0)
    const startIndex = Math.max(0, Math.floor(initialOffset / 72) - 2)
    const endIndex = Math.min(options.count - 1, startIndex + 12)

    return {
      getTotalSize: () => options.count * 72,
      getVirtualItems: () =>
        Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => {
          const index = startIndex + offset

          return {
            end: (index + 1) * 72,
            index,
            key: index,
            lane: 0,
            size: 72,
            start: index * 72,
          }
        }),
      measureElement: virtualizerMock.measureElement,
      scrollToIndex: virtualizerMock.scrollToIndex,
    }
  },
}))

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
  offsetMinutes,
}: {
  id: string
  direction: 'inbound' | 'outbound'
  offsetMinutes: number
}): MessageRow {
  const createdAt = new Date(
    Date.UTC(2026, 4, 15, 8, offsetMinutes),
  ).toISOString()

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

function longThreadMessages(): Array<MessageRow> {
  return Array.from({ length: 90 }, (_, index) =>
    messageRow({
      id: `message-${index}`,
      direction: index < 40 ? 'outbound' : 'inbound',
      offsetMinutes: index,
    }),
  )
}

describe('VirtualizedMessageList unread behavior', () => {
  beforeEach(() => {
    virtualizerMock.latestOptions = null
    virtualizerMock.measureElement.mockClear()
    virtualizerMock.scrollToIndex.mockClear()
  })

  it('scrolls a long thread to the bottom on open while still rendering the unread divider', async () => {
    const messages = longThreadMessages()
    const lastMsg = messages.at(-1)
    if (!lastMsg) throw new Error('expected messages')

    const { container } = render(
      <VirtualizedMessageList
        messages={messages}
        contactName="Customer"
        currentUserId={null}
        initialScrollTarget={{
          messageId: lastMsg.id,
          reason: 'latest',
        }}
        unreadDividerMessageId="message-4"
        hasUnreadInboundMessages
        onReadAnchorVisible={vi.fn()}
        hasMoreOlder={false}
        isFetchingOlder={false}
        onLoadOlder={vi.fn()}
        scrollToLatestNonce={0}
      />,
    )

    const scrollNode = container.querySelector('.overflow-y-auto')
    if (!(scrollNode instanceof HTMLElement)) {
      throw new Error('Scroll container was not rendered')
    }

    // Pin must use scrollTop = scrollHeight (exact), not index scrolling based
    // on estimated item sizes (lands mid-thread when real heights differ).
    let scrollTopVal = 0
    Object.defineProperties(scrollNode, {
      scrollHeight: { configurable: true, value: 6000 },
      clientHeight: { configurable: true, value: 600 },
      scrollTop: {
        configurable: true,
        get: () => scrollTopVal,
        set: (value: number) => {
          scrollTopVal = value
        },
      },
    })

    await waitFor(() => expect(scrollTopVal).toBe(6000))

    expect(document.querySelector('[data-unread-divider]')).toBeTruthy()
    expect(virtualizerMock.scrollToIndex).not.toHaveBeenCalled()
  })
})
