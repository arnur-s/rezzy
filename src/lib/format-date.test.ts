import { setLocale } from '@/paraglide/runtime'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  calendarDaysBetween,
  formatDate,
  getCalendarDayKey,
  getDateFormatter,
} from './format-date'
import { setActiveTimeZone } from './time-zone'

/**
 * The bug this guards: formatters were built with `undefined` as the locale,
 * which resolves to the *browser's* language rather than the interface's. On a
 * Russian UI in an English browser that rendered "Участник с May 2026".
 */
describe('formatDate', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  afterEach(() => {
    setActiveTimeZone(null)
  })

  it('formats in the app locale, not the browser locale', () => {
    setLocale('ru', { reload: false })
    const ru = formatDate('2026-05-14T10:00:00Z', {
      year: 'numeric',
      month: 'long',
    })

    setLocale('en', { reload: false })
    const en = formatDate('2026-05-14T10:00:00Z', {
      year: 'numeric',
      month: 'long',
    })

    expect(ru).toContain('ма')
    expect(en).toContain('May')
    expect(ru).not.toBe(en)
  })

  it('returns an empty string for missing or unparseable values', () => {
    const options = { year: 'numeric' } as const

    expect(formatDate(null, options)).toBe('')
    expect(formatDate(undefined, options)).toBe('')
    expect(formatDate('not a date', options)).toBe('')
  })

  it('reuses one formatter per locale and option set', () => {
    const options = { day: 'numeric', month: 'short' } as const

    expect(getDateFormatter(options)).toBe(getDateFormatter(options))
  })

  it('does not serve one locale a formatter built for another', () => {
    const options = { month: 'long' } as const

    setLocale('en', { reload: false })
    const english = getDateFormatter(options)

    setLocale('ru', { reload: false })
    const russian = getDateFormatter(options)

    expect(russian).not.toBe(english)
  })
})

/**
 * The bug this guards: every timestamp was rendered in whatever zone the
 * machine happened to be set to, so an account that had chosen a zone still saw
 * its colleagues' messages land on the wrong hour — and, either side of
 * midnight, on the wrong day.
 */
describe('time zone', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  afterEach(() => {
    setActiveTimeZone(null)
  })

  it('formats in the account zone rather than the machine zone', () => {
    // 22:30 UTC is the 14th in London and already the 15th in Tokyo.
    const instant = '2026-05-14T22:30:00Z'
    const options = { day: 'numeric', month: 'short', hour: '2-digit' } as const

    setActiveTimeZone('Europe/London')
    const london = formatDate(instant, options)

    setActiveTimeZone('Asia/Tokyo')
    const tokyo = formatDate(instant, options)

    expect(london).toContain('14')
    expect(tokyo).toContain('15')
    expect(london).not.toBe(tokyo)
  })

  it('does not serve one zone a formatter built for another', () => {
    const options = { hour: '2-digit' } as const

    setActiveTimeZone('Europe/London')
    const london = getDateFormatter(options)

    setActiveTimeZone('Asia/Tokyo')
    const tokyo = getDateFormatter(options)

    expect(tokyo).not.toBe(london)
  })

  it('ignores a zone the runtime does not recognize', () => {
    const options = { hour: '2-digit' } as const
    const browser = getDateFormatter(options)

    setActiveTimeZone('Mars/Olympus_Mons')

    expect(getDateFormatter(options)).toBe(browser)
  })

  it('groups instants by the account calendar day', () => {
    const instant = '2026-05-14T22:30:00Z'

    setActiveTimeZone('Europe/London')
    expect(getCalendarDayKey(instant)).toBe('2026-05-14')

    setActiveTimeZone('Asia/Tokyo')
    expect(getCalendarDayKey(instant)).toBe('2026-05-15')
  })

  it('counts whole calendar days, not elapsed hours', () => {
    setActiveTimeZone('UTC')

    // Twenty minutes apart, but on either side of midnight: one day, not zero.
    expect(
      calendarDaysBetween('2026-05-15T00:10:00Z', '2026-05-14T23:50:00Z'),
    ).toBe(1)

    // Twenty-three hours apart inside one day: zero, not one.
    expect(
      calendarDaysBetween('2026-05-14T23:50:00Z', '2026-05-14T00:50:00Z'),
    ).toBe(0)
  })
})
