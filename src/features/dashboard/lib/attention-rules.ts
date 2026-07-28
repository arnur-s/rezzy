/**
 * The thresholds home judges a conversation by, and the predicates that apply
 * them.
 *
 * The summary line and the attention list describe the same conversations from
 * two angles, so when each owned its own copy of these rules they drifted: both
 * files declared `STALE_THRESHOLD_HOURS = 48` separately, and the snooze rules
 * disagreed outright. One module means a change to the definition cannot land
 * in the count without also landing in the list.
 *
 * The predicates are type guards, so a caller that passes the check also gets
 * the timestamp narrowed to non-null and can use it as the row's displayed
 * time without re-checking or asserting.
 */

/** A conversation with no reply for this long is aging on the agent's plate. */
export const STALE_THRESHOLD_HOURS = 48

/** How far ahead the summary looks when forecasting snoozes coming back. */
export const SNOOZE_HORIZON_HOURS = 24

const HOUR_MS = 60 * 60 * 1000

type SnoozeRow = {
  status: string
  snoozed_until: string | null
}

type StaleRow = {
  status: string
  last_message_at: string | null
}

type Snoozed<T extends SnoozeRow> = T & { snoozed_until: string }
type Stale<T extends StaleRow> = T & { last_message_at: string }

/**
 * True when an open conversation has gone quiet past the stale threshold.
 * Rows with no `last_message_at` are never stale: an empty conversation has
 * nothing to be waiting on.
 */
export function isStale<T extends StaleRow>(row: T, now: number): row is Stale<T> {
  if (row.status !== 'open') return false
  if (!row.last_message_at) return false
  return Date.parse(row.last_message_at) < now - STALE_THRESHOLD_HOURS * HOUR_MS
}

/**
 * True when a snooze has already elapsed, so the conversation is back on the
 * agent's plate right now. This is what the attention list acts on.
 */
export function isSnoozeElapsed<T extends SnoozeRow>(
  row: T,
  now: number,
): row is Snoozed<T> {
  if (row.status !== 'snoozed') return false
  if (!row.snoozed_until) return false
  return Date.parse(row.snoozed_until) <= now
}

/**
 * True when a snooze is elapsed or lands within the forecast horizon — the
 * "due back soon" the summary reports. Deliberately wider than
 * `isSnoozeElapsed`: the summary forecasts the next 24 hours while the list
 * shows only what is actionable now.
 *
 * A snoozed row with no `snoozed_until` is excluded. It was previously counted
 * as due soon, which is backwards: an open-ended snooze has no due date at all,
 * so it inflated the count with rows the list would never show and could keep
 * the all-clear from ever appearing.
 */
export function isSnoozeDueSoon<T extends SnoozeRow>(
  row: T,
  now: number,
): row is Snoozed<T> {
  if (row.status !== 'snoozed') return false
  if (!row.snoozed_until) return false
  return Date.parse(row.snoozed_until) <= now + SNOOZE_HORIZON_HOURS * HOUR_MS
}
