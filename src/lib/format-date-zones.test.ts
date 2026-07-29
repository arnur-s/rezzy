import { setLocale } from '@/paraglide/runtime'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { calendarDaysBetween, getCalendarDayKey, getCalendarHour } from './format-date'
import { setActiveTimeZone } from './time-zone'

/**
 * The unit tests above pin two or three zones by hand, which is enough to show
 * the wiring works and nothing about the several hundred zones a real account
 * can actually choose. Half-hour and three-quarter-hour offsets (Kolkata,
 * Kathmandu, Chatham), zones that cross the date line, and zones whose DST runs
 * on the southern hemisphere's calendar are all reachable from the dropdown and
 * none of them appear in a hand-picked pair.
 *
 * This sweeps every zone the runtime knows through the helpers that decide what
 * day and hour something happened, asserting invariants rather than fixed
 * strings: a wrong answer here is a timestamp on the wrong day for a real user.
 */
const ZONES = Intl.supportedValuesOf('timeZone')

// A winter instant and a summer one, so both DST phases are covered in both
// hemispheres, plus one either side of UTC midnight where day boundaries bite.
const INSTANTS = [
  '2026-01-15T12:00:00Z',
  '2026-07-15T12:00:00Z',
  '2026-05-14T23:50:00Z',
  '2026-05-15T00:10:00Z',
]

describe('every IANA zone', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  afterEach(() => {
    setActiveTimeZone(null)
  })

  it('produces a sortable YYYY-MM-DD day key within a day of UTC', () => {
    for (const zone of ZONES) {
      setActiveTimeZone(zone)

      for (const instant of INSTANTS) {
        const key = getCalendarDayKey(instant)

        expect(key, `${zone} @ ${instant}`).toMatch(/^\d{4}-\d{2}-\d{2}$/)

        // No zone is more than 26 hours from UTC, so the local day can differ
        // from the UTC day by one at most. A larger gap means the formatter
        // fell back or the parse-back is wrong.
        const drift = Math.abs(
          calendarDaysBetween(key, instant.slice(0, 10)),
        )
        expect(drift, `${zone} @ ${instant}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('produces an hour in range, including half-hour offset zones', () => {
    for (const zone of ZONES) {
      setActiveTimeZone(zone)

      for (const instant of INSTANTS) {
        const hour = getCalendarHour(new Date(instant))

        expect(hour, `${zone} @ ${instant}`).toBeGreaterThanOrEqual(0)
        expect(hour, `${zone} @ ${instant}`).toBeLessThanOrEqual(23)
        expect(Number.isInteger(hour), `${zone} @ ${instant}`).toBe(true)
      }
    }
  })

  it('agrees with the day key about which hour rolls the day over', () => {
    // The two helpers build separate formatters, so they could disagree. If
    // they ever did, a message could sit under a "Today" heading while its own
    // timestamp read 23:xx of the previous day.
    for (const zone of ZONES) {
      setActiveTimeZone(zone)

      const before = '2026-05-14T23:50:00Z'
      const after = '2026-05-15T00:10:00Z'

      const sameDay = getCalendarDayKey(before) === getCalendarDayKey(after)
      const hourWrapped = getCalendarHour(new Date(after)) <
        getCalendarHour(new Date(before))

      // Different days implies the clock wrapped past midnight between them.
      if (!sameDay) {
        expect(hourWrapped, zone).toBe(true)
      }
    }
  })

  it('counts calendar days independently of the machine zone', () => {
    // `calendarDaysBetween` reads its two day keys back as instants in order to
    // subtract them. Parsed without an explicit `Z` that read-back happens in
    // the *machine's* zone, and on any day where the two sides straddle a DST
    // shift the difference stops being a whole number of days — the rounding
    // then lands a day out, and a message gets the wrong heading. The keys are
    // calendar labels, so both sides have to be read on the same fixed clock.
    const springForward = ['2026-03-28', '2026-03-29', '2026-03-30']
    const fallBack = ['2026-10-24', '2026-10-25', '2026-10-26']

    for (const zone of ZONES) {
      setActiveTimeZone(zone)

      for (const run of [springForward, fallBack]) {
        for (let i = 1; i < run.length; i += 1) {
          expect(
            calendarDaysBetween(run[i], run[i - 1]),
            `${zone} ${run[i - 1]}..${run[i]}`,
          ).toBe(1)
        }

        expect(
          calendarDaysBetween(run[run.length - 1], run[0]),
          `${zone} ${run[0]}..${run[run.length - 1]}`,
        ).toBe(run.length - 1)
      }
    }
  })
})
