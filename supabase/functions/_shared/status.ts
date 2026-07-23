// Normalized status ordering, mirroring the apply_latest_message_status
// database trigger (migration 20260723090300). The DB projection is the source
// of truth for messages.status; this module lets webhook code and tests reason
// about ordering without a round-trip.

import type { StatusEventStatus } from './types.ts'

/** Statuses that project onto messages.status, in advance-only order. */
export const PROJECTED_STATUS_RANK: Readonly<
  Partial<Record<StatusEventStatus, number>>
> = {
  sent: 3,
  delivered: 4,
  read: 5,
  played: 6,
  failed: 7,
}

export function isProjectedStatus(status: StatusEventStatus): boolean {
  return status in PROJECTED_STATUS_RANK
}

/**
 * Whether `next` should replace `current` as the latest message status.
 * `failed` is terminal for undelivered messages but never overrides
 * read/played; ranked statuses only ever advance.
 */
export function shouldAdvanceStatus(
  current: string | null,
  next: StatusEventStatus,
): boolean {
  const nextRank = PROJECTED_STATUS_RANK[next]
  if (nextRank === undefined) return false
  if (next === 'failed') {
    return current !== 'read' && current !== 'played' && current !== 'failed'
  }
  const currentRank =
    current === null
      ? 0
      : (PROJECTED_STATUS_RANK[current as StatusEventStatus] ?? 0)
  return currentRank < nextRank
}
