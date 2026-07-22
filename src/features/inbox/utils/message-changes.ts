import type { MessageRow } from '@/entities/message'

export type MessageListDiff = {
  /** New rows that appeared before every surviving previous row (older pages). */
  prepended: Array<MessageRow>
  /** New rows that appeared at or after the surviving previous rows. */
  appended: Array<MessageRow>
}

const EMPTY_DIFF: MessageListDiff = { prepended: [], appended: [] }

/**
 * Classifies how `next` differs from `previous` using stable message IDs.
 *
 * Rows whose ID already existed are never reported, which makes the diff
 * immune to status-only updates, realtime duplicate delivery, and optimistic
 * rows being confirmed in place (the optimistic row and the DB row share one
 * client-generated ID). Removals (e.g. optimistic rollback) are intentionally
 * not surfaced — no scroll behavior hangs off them.
 *
 * A genuinely new row that sorts between surviving rows (out-of-order
 * realtime arrival) counts as appended: it is new content, not history.
 */
export function diffMessageLists(
  previous: Array<MessageRow>,
  next: Array<MessageRow>,
): MessageListDiff {
  if (previous.length === 0) {
    return { prepended: [], appended: [...next] }
  }

  const previousIds = new Set(previous.map((row) => row.id))

  let firstSurvivingIndex = -1
  for (let i = 0; i < next.length; i++) {
    if (previousIds.has(next[i].id)) {
      firstSurvivingIndex = i
      break
    }
  }

  // Nothing survived: the cache was replaced wholesale (conversation reset),
  // not an incremental change worth reacting to.
  if (firstSurvivingIndex === -1) {
    return EMPTY_DIFF
  }

  const prepended: Array<MessageRow> = []
  const appended: Array<MessageRow> = []

  for (let i = 0; i < next.length; i++) {
    const row = next[i]
    if (previousIds.has(row.id)) continue
    if (i < firstSurvivingIndex) {
      prepended.push(row)
    } else {
      appended.push(row)
    }
  }

  return { prepended, appended }
}

/** Outbound from the current user; when the user id is unknown, any outbound counts as own. */
export function isOwnOutboundMessage(
  message: MessageRow,
  currentUserId: string | null,
): boolean {
  if (message.direction !== 'outbound') return false
  if (currentUserId == null) return true
  return message.sender_id == null || message.sender_id === currentUserId
}

/**
 * Inbound or outbound from another workspace agent — must not steal the
 * viewport while the user is reading history; feeds the "new messages" button.
 */
export function isInterruptingMessage(
  message: MessageRow,
  currentUserId: string | null,
): boolean {
  if (message.direction === 'inbound') return true
  return (
    message.direction === 'outbound' &&
    !isOwnOutboundMessage(message, currentUserId)
  )
}

/** Merges newly appended interrupting message IDs into the pending list, keeping IDs unique. */
export function mergePendingMessageIds(
  pending: Array<string>,
  incoming: Array<string>,
): Array<string> {
  const merged = [...pending]
  const seen = new Set(pending)
  for (const id of incoming) {
    if (seen.has(id)) continue
    seen.add(id)
    merged.push(id)
  }
  return merged.length === pending.length ? pending : merged
}
