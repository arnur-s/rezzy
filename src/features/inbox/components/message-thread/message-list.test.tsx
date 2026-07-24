import type { MessageRow } from '@/entities/message'
import { setLocale } from '@/paraglide/runtime'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    reply_to_message_id: null,
    external_reply_to_id: null,
    edited_at: null,
    deleted_at: null,
    provider_timestamp: null,
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

const baseProps = {
  conversationId: 'conversation-1',
  isLoading: false,
  isError: false,
  contactName: 'Customer',
  currentUserId: null,
  unreadDividerMessageId: null,
  hasUnreadInboundMessages: false,
} as const

describe('MessageList polish states', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('renders neither error nor empty state while loading', () => {
    render(
      <MessageList
        {...baseProps}
        messages={undefined}
        isLoading
        onReadAnchorVisible={vi.fn()}
      />,
    )

    expect(screen.queryByText(/Could not load messages/i)).toBeNull()
    expect(screen.queryByText(/No messages yet/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /Retry/i })).toBeNull()
  })

  it('renders an error alert with a retry button when isError is true', () => {
    const onRetry = vi.fn()

    render(
      <MessageList
        {...baseProps}
        messages={undefined}
        isError
        onReadAnchorVisible={vi.fn()}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText(/Could not load messages/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('renders the empty-thread state with the contact name when messages is empty after load', () => {
    render(
      <MessageList
        {...baseProps}
        contactName="Acme Co."
        messages={[]}
        onReadAnchorVisible={vi.fn()}
      />,
    )

    expect(screen.getByText(/No messages yet/i)).toBeTruthy()
    expect(screen.getByText(/Acme Co\./i)).toBeTruthy()
  })

  it('does not render the empty-thread state while older messages are being fetched', () => {
    render(
      <MessageList
        {...baseProps}
        messages={[]}
        onReadAnchorVisible={vi.fn()}
        hasMoreOlder
        isFetchingOlder
      />,
    )

    expect(screen.queryByText(/No messages yet/i)).toBeNull()
  })
})

describe('MessageList virtualized transcript', () => {
  // jsdom computes no layout, so every rect is 0×0 and the virtualizer would
  // render nothing. Give elements a plausible size; real geometry is covered
  // by the Playwright scroll tests.
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect

  beforeEach(() => {
    setLocale('en', { reload: false })
    Element.prototype.getBoundingClientRect = () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 600,
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 800,
    })
  })

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect
    delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
    delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth
  })

  it('always renders the virtualized transcript for non-empty threads (no threshold)', () => {
    const { container } = render(
      <MessageList
        {...baseProps}
        messages={baseMessages.slice(0, 1)}
        onReadAnchorVisible={vi.fn()}
      />,
    )

    expect(
      container.querySelector('[data-testid="message-transcript"]'),
    ).toBeTruthy()
    expect(container.querySelector('[data-index]')).toBeTruthy()
  })

  // Rows previously used Tailwind's `container`, whose max-width tracks the
  // breakpoint (up to 1536px), so messages sprawled across a wide pane. The
  // transcript must stay on a fixed readable column instead.
  it('constrains message rows to the readable transcript measure', () => {
    const { container } = render(
      <MessageList
        {...baseProps}
        messages={baseMessages}
        onReadAnchorVisible={vi.fn()}
      />,
    )

    const row = container.querySelector('[data-index] > div')
    expect(row).toBeTruthy()

    const className = row?.getAttribute('class') ?? ''
    expect(className).toContain('max-w-[820px]')
    expect(className).toContain('mx-auto')
    expect(className.split(/\s+/)).not.toContain('container')
  })

  it('renders the unread divider at its transcript position', () => {
    render(
      <MessageList
        {...baseProps}
        messages={baseMessages}
        unreadDividerMessageId="first-unread"
        hasUnreadInboundMessages
        onReadAnchorVisible={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-unread-divider]')).toBeTruthy()
  })

  it('commits the read anchor once for a short thread that opens at the end', async () => {
    const onReadAnchorVisible = vi.fn()

    const { rerender } = render(
      <MessageList
        {...baseProps}
        messages={baseMessages}
        unreadDividerMessageId="first-unread"
        hasUnreadInboundMessages
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    await waitFor(() =>
      expect(onReadAnchorVisible).toHaveBeenCalledWith('latest'),
    )

    // A status-only update to the latest message must not re-commit.
    onReadAnchorVisible.mockClear()
    rerender(
      <MessageList
        {...baseProps}
        messages={baseMessages.map((row) =>
          row.id === 'latest' ? { ...row, status: 'delivered' } : row,
        )}
        unreadDividerMessageId="first-unread"
        hasUnreadInboundMessages
        onReadAnchorVisible={onReadAnchorVisible}
      />,
    )

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(onReadAnchorVisible).not.toHaveBeenCalled()
  })
})
