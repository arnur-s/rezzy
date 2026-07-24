import { sortConversationsByActivity } from '@/entities/conversation'
import type { ConversationWithRelations } from '@/entities/conversation'

/** Most recent unread conversations shown before "view all" takes over. */
export const UNREAD_NOTIFICATIONS_LIMIT = 6

/** A rendered notification row: the conversation plus its display context. */
export type UnreadNotification = {
  conversation: ConversationWithRelations
  /** Shown only when the agent belongs to more than one workspace. */
  workspaceName: string | null
}

export type UnreadNotificationsViewModel = {
  /** Unread conversations (unread_count > 0), newest activity first, capped. */
  items: Array<UnreadNotification>
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

/**
 * Builds the popover view model from conversations and unread counts that may
 * span several workspaces. Conversation ids are globally unique, so callers can
 * merge per-workspace queries into one list and one counts map before calling.
 *
 * `workspaceNames` labels rows with their workspace; pass an empty map to hide
 * the label (the agent only has one workspace, so it carries no information).
 */
export function buildUnreadNotificationsViewModel(
  conversations: Array<ConversationWithRelations> | undefined,
  unreadCounts: Record<string, number> | undefined,
  workspaceNames: ReadonlyMap<string, string> = new Map(),
  limit: number = UNREAD_NOTIFICATIONS_LIMIT,
): UnreadNotificationsViewModel {
  const overlaid = overlayUnreadCounts(conversations, unreadCounts)
  return {
    items: selectUnreadConversations(overlaid, limit).map((conversation) => ({
      conversation,
      workspaceName: workspaceNames.get(conversation.workspace_id) ?? null,
    })),
    totalUnread: totalUnreadCount(overlaid),
  }
}
