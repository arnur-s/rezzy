import type { MessageNotificationDetails } from '../model/types'

/** Messages retained per conversation. The chip still counts the rest. */
export const NOTIFICATION_GROUP_LIMIT = 5

export type NotificationGroup = {
  /** Oldest first, newest last. At most `NOTIFICATION_GROUP_LIMIT` entries. */
  items: Array<MessageNotificationDetails>
  /** Every message seen while this conversation's toast has been live. */
  total: number
}

const groups = new Map<string, NotificationGroup>()

/**
 * Add a message to its conversation's live group and return the new snapshot.
 *
 * A group lives exactly as long as the toast that renders it. Astryx's
 * `overwrite` collision behavior swaps the toast entry via `prev.map(...)`
 * without calling `removeToast`, so `onHide` never fires on regrouping — only
 * a real dismiss or auto-hide clears the group.
 */
export function appendToNotificationGroup(
  details: MessageNotificationDetails,
): NotificationGroup {
  const current = groups.get(details.conversationId)

  // Realtime can redeliver a row. `NotificationDeduper` already guards the
  // presentation path, but the store is cheap to make idempotent on its own.
  if (current?.items.some((item) => item.id === details.id)) {
    return current
  }

  const next: NotificationGroup = {
    items: [...(current?.items ?? []), details].slice(-NOTIFICATION_GROUP_LIMIT),
    total: (current?.total ?? 0) + 1,
  }
  groups.set(details.conversationId, next)
  return next
}

/** Drop a conversation's group once its toast is gone. */
export function clearNotificationGroup(conversationId: string): void {
  groups.delete(conversationId)
}

/** Test seam. The store is a module singleton, like the toast viewport. */
export function resetNotificationGroups(): void {
  groups.clear()
}
