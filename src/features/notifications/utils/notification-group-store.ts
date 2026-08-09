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
 * Explicit expand/collapse overrides, keyed like the groups themselves.
 *
 * `true` pinned open, `false` pinned closed, absent means "no opinion" and
 * hover decides. This lives beside the group rather than in component state
 * because Astryx's `overwrite` path mints a new toast entry — and so a new
 * React key — for every message, remounting the body and resetting anything it
 * held. The group already has exactly the right lifetime: created with the
 * first message, dropped in `onHide`.
 */
const pins = new Map<string, boolean>()

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

/**
 * The group's explicit expand/collapse override, or `null` when it has none.
 *
 * Read as the initial value every time the toast body mounts, so an expanded
 * group stays expanded when the next message remounts it.
 */
export function getNotificationGroupPin(
  conversationId: string,
): boolean | null {
  return pins.get(conversationId) ?? null
}

/** Record an explicit expand (`true`), collapse (`false`), or reset (`null`). */
export function setNotificationGroupPin(
  conversationId: string,
  pinned: boolean | null,
): void {
  if (pinned === null) pins.delete(conversationId)
  else pins.set(conversationId, pinned)
}

/** Drop a conversation's group once its toast is gone. */
export function clearNotificationGroup(conversationId: string): void {
  groups.delete(conversationId)
  pins.delete(conversationId)
}

/** Test seam. The store is a module singleton, like the toast viewport. */
export function resetNotificationGroups(): void {
  groups.clear()
  pins.clear()
}
