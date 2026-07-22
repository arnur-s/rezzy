import type { MessageRow } from '@/entities/message'

/**
 * Read-commit gate: returns the message ID to commit as read, or null.
 * A commit is eligible only when unread inbound messages exist, the viewport
 * is at the transcript end, and this latest ID has not been committed yet —
 * so status updates and repeat scroll events never re-commit the same cursor.
 */
export function getEligibleReadCommitId({
  hasUnreadInboundMessages,
  isAtEnd,
  latestMessageId,
  lastCommittedMessageId,
}: {
  hasUnreadInboundMessages: boolean
  isAtEnd: boolean
  latestMessageId: string | null
  lastCommittedMessageId: string | null
}): string | null {
  if (!hasUnreadInboundMessages || !isAtEnd) return null
  if (!latestMessageId) return null
  if (latestMessageId === lastCommittedMessageId) return null
  return latestMessageId
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
