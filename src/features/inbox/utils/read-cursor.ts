import type { MessageRow } from '@/entities/message'

/** Scroll target when opening a thread: always the latest message (bottom). */
export type InitialScrollTarget = {
  messageId: string | null
  reason: 'latest'
}

export function getInitialScrollTarget({
  messages,
}: {
  messages: Array<MessageRow>
}): InitialScrollTarget {
  const latest = messages.at(-1)
  if (!latest) {
    return { messageId: null, reason: 'latest' }
  }
  return { messageId: latest.id, reason: 'latest' }
}

/**
 * First inbound message that should show the "unread" divider before it.
 * Outbound messages never qualify and never affect the result.
 */
export function getFirstUnreadInboundMessageId({
  messages,
  lastReadMessageId,
  lastReadAt,
  unreadCount = 0,
}: {
  messages: Array<MessageRow>
  lastReadMessageId: string | null
  lastReadAt: string | null
  unreadCount?: number
}): string | null {
  if (messages.length === 0) return null

  if (lastReadMessageId) {
    const cursorIndex = messages.findIndex((m) => m.id === lastReadMessageId)
    if (cursorIndex !== -1) {
      if (unreadCount <= 0) return null
      const firstInbound = messages
        .slice(cursorIndex + 1)
        .find((m) => m.direction === 'inbound')
      return firstInbound?.id ?? null
    }
  }

  if (lastReadAt) {
    for (const m of messages) {
      if (m.direction === 'inbound' && m.created_at > lastReadAt) {
        return m.id
      }
    }
  }

  if (unreadCount > 0) {
    return firstUnreadInboundFromTailHeuristic(messages, unreadCount)
  }

  return null
}

/** When read cursor id is missing: last N inbound by unreadCount; guard stale counts vs outbound tail. */
function firstUnreadInboundFromTailHeuristic(
  messages: Array<MessageRow>,
  unreadCount: number,
): string | null {
  const inbound = messages.filter((row) => row.direction === 'inbound')
  if (inbound.length === 0) return null

  const tail = inbound.slice(-unreadCount)
  for (const candidate of tail) {
    const lastMsg = messages[messages.length - 1]
    if (
      lastMsg.direction === 'outbound' &&
      candidate.created_at < lastMsg.created_at
    ) {
      return null
    }

    return candidate.id
  }

  return null
}
