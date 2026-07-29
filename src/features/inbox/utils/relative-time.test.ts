import { setActiveTimeZone } from '@/lib/time-zone'
import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dayKey, formatDayHeading, formatRelativeShort } from './relative-time'

/**
 * These all guard the same bug from different angles: "today", "yesterday", and
 * the breaks between day groups were decided by the *machine's* midnight rather
 * than the account's. For anyone working across a zone boundary that put the
 * wrong heading above a run of messages and moved the run itself to the wrong
 * side of it.
 */
describe('relative-time in the account zone', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    // 00:30 on the 15th in UTC. Still the evening of the 14th in New York.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T00:30:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    setActiveTimeZone(null)
  })

  it('calls an instant yesterday once the account day has turned over', () => {
    // Two and a half hours ago, which is the previous calendar day in UTC but
    // still the same evening in New York. Under an hour the elapsed duration
    // wins on purpose — "40 min" tells you more than "Yesterday" does — so the
    // gap has to clear that branch for the calendar to be what is under test.
    const instant = '2026-05-14T22:00:00Z'

    setActiveTimeZone('UTC')
    expect(formatRelativeShort(instant)).toBe(m.inbox_relative_yesterday())

    // The same instant is 18:00 the same evening in New York, so it is today.
    setActiveTimeZone('America/New_York')
    expect(formatRelativeShort(instant)).not.toBe(m.inbox_relative_yesterday())
  })

  it('heads a group with the account day, not the machine day', () => {
    const instant = '2026-05-14T23:50:00Z'

    setActiveTimeZone('UTC')
    expect(formatDayHeading(instant)).toBe(m.inbox_day_yesterday())

    setActiveTimeZone('America/New_York')
    expect(formatDayHeading(instant)).toBe(m.inbox_day_today())
  })

  it('groups by the account calendar day', () => {
    const evening = '2026-05-14T23:50:00Z'
    const afterMidnight = '2026-05-15T00:10:00Z'

    setActiveTimeZone('UTC')
    expect(dayKey(evening)).not.toBe(dayKey(afterMidnight))

    // Both fall in the same New York evening, so they belong to one group.
    setActiveTimeZone('America/New_York')
    expect(dayKey(evening)).toBe(dayKey(afterMidnight))
  })
})
