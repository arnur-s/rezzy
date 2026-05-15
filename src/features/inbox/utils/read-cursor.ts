import type { MessageRow } from '@/entities/message'

export type InitialScrollTarget = {
  messageId: string | null
  reason: 'first-unread' | 'last-read' | 'latest'
}

export function getInitialScrollTarget({
  messages,
  lastReadMessageId,
  unreadCount,
}: {
  messages: Array<MessageRow>
  lastReadMessageId: string | null
  unreadCount: number
}): InitialScrollTarget {
  const latest = messages.at(-1)
  if (!latest) {
    return { messageId: null, reason: 'latest' }
  }

  const unreadTailTarget = getUnreadTailTarget(messages, unreadCount)

  if (!lastReadMessageId) {
    return unreadTailTarget ?? { messageId: latest.id, reason: 'latest' }
  }

  const cursorIndex = messages.findIndex(
    (message) => message.id === lastReadMessageId,
  )
  if (cursorIndex === -1) {
    return unreadTailTarget ?? { messageId: latest.id, reason: 'latest' }
  }

  if (unreadCount > 0) {
    const firstUnread = messages
      .slice(cursorIndex + 1)
      .find((message) => message.direction === 'inbound')

    if (firstUnread) {
      return { messageId: firstUnread.id, reason: 'first-unread' }
    }
  }

  return { messageId: lastReadMessageId, reason: 'last-read' }
}

function getUnreadTailTarget(
  messages: Array<MessageRow>,
  unreadCount: number,
): InitialScrollTarget | null {
  if (unreadCount <= 0) return null

  const inboundTail = messages
    .filter((message) => message.direction === 'inbound')
    .slice(-unreadCount)

  const firstUnread = inboundTail.at(0)
  return firstUnread
    ? { messageId: firstUnread.id, reason: 'first-unread' }
    : null
}
