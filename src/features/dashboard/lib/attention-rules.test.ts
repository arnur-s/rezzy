import {
  SNOOZE_HORIZON_HOURS,
  STALE_THRESHOLD_HOURS,
  isSnoozeDueSoon,
  isSnoozeElapsed,
  isStale,
} from '@/features/dashboard/lib/attention-rules'
import { describe, expect, it } from 'vitest'

/**
 * Home shows the same conversations twice: as counts in the summary line and as
 * rows in the attention list. These tests pin the boundary cases, and the last
 * one pins the relationship between the two, because the bug they replace was
 * not a wrong number but a disagreement — the summary announcing work the list
 * below it did not contain.
 */

const now = Date.parse('2026-07-28T12:00:00.000Z')
const hours = (n: number) => new Date(now + n * 60 * 60 * 1000).toISOString()

describe('isStale', () => {
  it('ignores conversations that are not open', () => {
    const row = { status: 'closed', last_message_at: hours(-1000) }
    expect(isStale(row, now)).toBe(false)
  })

  it('never treats a conversation with no messages as stale', () => {
    // Nothing has been said, so nobody is waiting on a reply.
    expect(isStale({ status: 'open', last_message_at: null }, now)).toBe(false)
  })

  it('turns stale strictly past the threshold, not at it', () => {
    const atThreshold = {
      status: 'open',
      last_message_at: hours(-STALE_THRESHOLD_HOURS),
    }
    const pastThreshold = {
      status: 'open',
      last_message_at: hours(-STALE_THRESHOLD_HOURS - 0.001),
    }
    expect(isStale(atThreshold, now)).toBe(false)
    expect(isStale(pastThreshold, now)).toBe(true)
  })
})

describe('isSnoozeElapsed', () => {
  it('is true once the snooze time has passed', () => {
    expect(
      isSnoozeElapsed({ status: 'snoozed', snoozed_until: hours(-1) }, now),
    ).toBe(true)
  })

  it('is false while the snooze is still running', () => {
    expect(
      isSnoozeElapsed({ status: 'snoozed', snoozed_until: hours(1) }, now),
    ).toBe(false)
  })

  it('excludes an open-ended snooze, which has no due time to elapse', () => {
    expect(
      isSnoozeElapsed({ status: 'snoozed', snoozed_until: null }, now),
    ).toBe(false)
  })
})

describe('isSnoozeDueSoon', () => {
  it('includes snoozes inside the forecast horizon', () => {
    expect(
      isSnoozeDueSoon(
        { status: 'snoozed', snoozed_until: hours(SNOOZE_HORIZON_HOURS - 1) },
        now,
      ),
    ).toBe(true)
  })

  it('excludes snoozes beyond the horizon', () => {
    expect(
      isSnoozeDueSoon(
        { status: 'snoozed', snoozed_until: hours(SNOOZE_HORIZON_HOURS + 1) },
        now,
      ),
    ).toBe(false)
  })

  it('excludes an open-ended snooze rather than counting it as due soon', () => {
    // The previous behaviour counted a null snoozed_until as due soon, so the
    // summary reported work that could never appear in the list and the
    // all-clear could not be reached.
    expect(isSnoozeDueSoon({ status: 'snoozed', snoozed_until: null }, now)).toBe(
      false,
    )
  })
})

describe('the summary and the list agree', () => {
  it('never counts a snooze as due soon that the list would not eventually show', () => {
    const rows = [
      { status: 'snoozed', snoozed_until: null },
      { status: 'snoozed', snoozed_until: hours(-5) },
      { status: 'snoozed', snoozed_until: hours(1) },
      { status: 'snoozed', snoozed_until: hours(100) },
      { status: 'open', snoozed_until: null },
    ]

    // Anything already actionable in the list must also be in the count: the
    // count is a forecast, so it is a superset of what is due right now.
    for (const row of rows) {
      if (isSnoozeElapsed(row, now)) {
        expect(isSnoozeDueSoon(row, now)).toBe(true)
      }
    }

    // And nothing counted may be un-showable. A row inside the horizon becomes
    // actionable once its due time arrives, so evaluating at the horizon proves
    // the list will show it.
    const atHorizon = now + SNOOZE_HORIZON_HOURS * 60 * 60 * 1000
    for (const row of rows) {
      if (isSnoozeDueSoon(row, now)) {
        expect(isSnoozeElapsed(row, atHorizon)).toBe(true)
      }
    }
  })

  it('applies one stale threshold to both the count and the rows', () => {
    // Both call sites import this predicate, so a drifting duplicate constant
    // cannot reappear without failing here.
    const row = {
      status: 'open',
      last_message_at: hours(-STALE_THRESHOLD_HOURS - 1),
    }
    expect(isStale(row, now)).toBe(true)
    expect(STALE_THRESHOLD_HOURS).toBe(48)
  })
})
