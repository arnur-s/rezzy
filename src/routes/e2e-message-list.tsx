import type { MessageRow } from '@/entities/message'
import { MessageList } from '@/features/inbox/components/message-thread/message-list'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/e2e-message-list')({
  component: MessageListHarness,
})

/**
 * Dev-only Playwright harness for the virtualized message transcript.
 * Renders MessageList with fully deterministic in-page data and exposes
 * imperative controls on `window.__mtHarness` so browser tests can append,
 * prepend, and mutate messages without a backend. Renders nothing in
 * production builds.
 */

const BASE_TIME = Date.UTC(2026, 6, 20, 6, 0, 0)
const MINUTE = 60_000

/** Deterministic, varied bubble sizes: 1–5 sentences depending on the index. */
function contentFor(index: number): string {
  const sentence =
    'Deterministic harness message text that wraps across lines at narrow widths. '
  return `#${index} ` + sentence.repeat((index % 5) + 1).trim()
}

function harnessMessage({
  index,
  direction,
  senderId = null,
  content,
}: {
  index: number
  direction: 'inbound' | 'outbound'
  senderId?: string | null
  content?: string
}): MessageRow {
  return {
    id: `m-${index}`,
    conversation_id: 'harness-conversation',
    workspace_id: 'harness-workspace',
    sender_id: senderId,
    direction,
    type: 'text',
    status: 'sent',
    content: content ?? contentFor(index),
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
    created_at: new Date(BASE_TIME + index * MINUTE).toISOString(),
  }
}

const CURRENT_USER_ID = 'agent-me'
const OTHER_AGENT_ID = 'agent-other'

type HarnessApi = {
  appendInbound: () => string
  appendOwnOutbound: () => string
  appendOtherAgentOutbound: () => string
  /** Re-delivers the current last message (same id, new row object) — realtime duplicate. */
  redeliverLast: () => void
  /** Status-only update of the given (or last) outbound/inbound message. */
  updateStatus: (id?: string) => void
  /** Replaces a message's content with a much taller block (late media load). */
  growMessage: (id: string) => void
  prependOlder: (count: number) => void
  setUnread: (dividerId: string | null, hasUnread: boolean) => void
  reselectConversation: () => void
  switchConversation: () => void
  setComposerHeight: (px: number) => void
  getState: () => {
    conversationId: string
    messageIds: Array<string>
    readCommits: Array<string>
  }
}

declare global {
  interface Window {
    __mtHarness?: HarnessApi
    __readCommits?: Array<string>
  }
}

function initialMessages(count: number): Array<MessageRow> {
  // Indexes 1000.. so prepends can use lower indexes while staying older.
  return Array.from({ length: count }, (_, i) =>
    harnessMessage({
      index: 1000 + i,
      direction: i % 3 === 2 ? 'outbound' : 'inbound',
      senderId: i % 3 === 2 ? CURRENT_USER_ID : null,
    }),
  )
}

function MessageListHarness() {
  const [conversationId, setConversationId] = useState('harness-conversation')
  const [messages, setMessages] = useState<Array<MessageRow>>(() => {
    const params = new URLSearchParams(window.location.search)
    return initialMessages(Number(params.get('count') ?? 30))
  })
  const nextIndexRef = useRef(5000)
  const oldestIndexRef = useRef(1000)
  const [unreadDividerMessageId, setUnreadDividerMessageId] = useState<
    string | null
  >(null)
  const [hasUnreadInboundMessages, setHasUnreadInboundMessages] =
    useState(false)
  const [scrollToLatestNonce, setScrollToLatestNonce] = useState(0)
  const [composerHeight, setComposerHeight] = useState(56)

  const handleReadAnchorVisible = useCallback((id: string) => {
    window.__readCommits = [...(window.__readCommits ?? []), id]
    setHasUnreadInboundMessages(false)
  }, [])

  useEffect(() => {
    window.__readCommits = window.__readCommits ?? []

    const append = (row: MessageRow) => {
      setMessages((current) =>
        current.some((m) => m.id === row.id)
          ? current.map((m) => (m.id === row.id ? row : m))
          : [...current, row],
      )
    }

    const api: HarnessApi = {
      appendInbound: () => {
        const index = nextIndexRef.current++
        append(harnessMessage({ index, direction: 'inbound' }))
        setHasUnreadInboundMessages(true)
        return `m-${index}`
      },
      appendOwnOutbound: () => {
        const index = nextIndexRef.current++
        append(
          harnessMessage({
            index,
            direction: 'outbound',
            senderId: CURRENT_USER_ID,
          }),
        )
        return `m-${index}`
      },
      appendOtherAgentOutbound: () => {
        const index = nextIndexRef.current++
        append(
          harnessMessage({
            index,
            direction: 'outbound',
            senderId: OTHER_AGENT_ID,
          }),
        )
        return `m-${index}`
      },
      redeliverLast: () => {
        setMessages((current) => {
          const last = current.at(-1)
          if (!last) return current
          return current.map((m) => (m.id === last.id ? { ...m } : m))
        })
      },
      updateStatus: (id) => {
        setMessages((current) => {
          const targetId = id ?? current.at(-1)?.id
          return current.map((m) =>
            m.id === targetId ? { ...m, status: 'delivered' } : m,
          )
        })
      },
      growMessage: (id) => {
        setMessages((current) =>
          current.map((m) =>
            m.id === id
              ? {
                  ...m,
                  content: `${m.content ?? ''}\n${'Grown media block line.\n'.repeat(12)}`,
                }
              : m,
          ),
        )
      },
      prependOlder: (count) => {
        const start = oldestIndexRef.current - count
        oldestIndexRef.current = start
        const older = Array.from({ length: count }, (_, i) =>
          harnessMessage({
            index: start + i,
            direction: i % 2 === 0 ? 'inbound' : 'outbound',
            senderId: i % 2 === 0 ? null : CURRENT_USER_ID,
          }),
        )
        setMessages((current) => [...older, ...current])
      },
      setUnread: (dividerId, hasUnread) => {
        setUnreadDividerMessageId(dividerId)
        setHasUnreadInboundMessages(hasUnread)
      },
      reselectConversation: () => {
        setScrollToLatestNonce((nonce) => nonce + 1)
      },
      switchConversation: () => {
        setConversationId((current) =>
          current === 'harness-conversation'
            ? 'harness-conversation-2'
            : 'harness-conversation',
        )
        nextIndexRef.current = 5000
        oldestIndexRef.current = 1000
        setMessages(initialMessages(40))
        setUnreadDividerMessageId(null)
        setHasUnreadInboundMessages(false)
        window.__readCommits = []
      },
      setComposerHeight,
      getState: () => ({
        conversationId,
        messageIds: messages.map((m) => m.id),
        readCommits: window.__readCommits ?? [],
      }),
    }

    window.__mtHarness = api
    return () => {
      delete window.__mtHarness
    }
  }, [conversationId, messages])

  if (!import.meta.env.DEV) return null

  return (
    <div className="flex h-dvh flex-col" data-testid="harness-root">
      <MessageList
        conversationId={conversationId}
        messages={messages}
        isLoading={false}
        isError={false}
        contactName="Harness Contact"
        currentUserId={CURRENT_USER_ID}
        unreadDividerMessageId={unreadDividerMessageId}
        hasUnreadInboundMessages={hasUnreadInboundMessages}
        onReadAnchorVisible={handleReadAnchorVisible}
        hasMoreOlder={false}
        isFetchingOlder={false}
        onLoadOlder={() => {}}
        scrollToLatestNonce={scrollToLatestNonce}
      />
      <div
        data-testid="harness-composer"
        className="shrink-0 border-t border-border"
        style={{ height: composerHeight }}
      />
    </div>
  )
}
