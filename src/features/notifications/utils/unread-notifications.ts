import { sortConversationsByActivity } from '@/entities/conversation'
import type { ConversationWithRelations } from '@/entities/conversation'

/** Most recent unread conversations shown before "view all" takes over. */
export const UNREAD_NOTIFICATIONS_LIMIT = 6

export type UnreadNotificationsViewModel = {
  /** Unread conversations (unread_count > 0), newest activity first, capped. */
  items: Array<ConversationWithRelations>
  /** Sum of unread messages across every conversation, not just the capped list. */
  totalUnread: number
}

/**
 * Mirror of the inbox-page overlay: per-agent unread counts (from read cursors)
 * merged onto conversation rows, so the bell agrees with the inbox list.
 */
export function overlayUnreadCounts(
  conversations: Array<ConversationWithRelations> | undefined,
  unreadCounts: Record<string, number> | undefined,
): Array<ConversationWithRelations> {
  if (!conversations) return []
  return conversations.map((row) => ({
    ...row,
    unread_count: Math.max(0, unreadCounts?.[row.id] ?? 0),
  }))
}

export function selectUnreadConversations(
  conversations: Array<ConversationWithRelations>,
  limit: number = UNREAD_NOTIFICATIONS_LIMIT,
): Array<ConversationWithRelations> {
  const unread = conversations.filter((row) => row.unread_count > 0)
  return sortConversationsByActivity(unread).slice(0, limit)
}

export function totalUnreadCount(
  conversations: Array<ConversationWithRelations>,
): number {
  return conversations.reduce(
    (sum, row) => sum + Math.max(0, row.unread_count),
    0,
  )
}

export function capUnreadCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}

export function buildUnreadNotificationsViewModel(
  conversations: Array<ConversationWithRelations> | undefined,
  unreadCounts: Record<string, number> | undefined,
  limit: number = UNREAD_NOTIFICATIONS_LIMIT,
): UnreadNotificationsViewModel {
  const overlaid = overlayUnreadCounts(conversations, unreadCounts)
  return {
    items: selectUnreadConversations(overlaid, limit),
    totalUnread: totalUnreadCount(overlaid),
  }
}
