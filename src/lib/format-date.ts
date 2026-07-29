import { getLocale } from '@/paraglide/runtime'
import { getActiveTimeZone } from './time-zone'

/**
 * Date and time formatters bound to the *app* locale.
 *
 * `new Intl.DateTimeFormat(undefined, …)` reads the browser's locale, not the
 * one the interface is rendered in. On a Russian UI in an en-US browser that
 * produced strings like "Участник с May 2026" — a Russian sentence with an
 * English month inside it. Every formatter in the product goes through here so
 * the two can't drift apart again.
 *
 * The locale comes from Paraglide rather than from `resolveLocale`, even though
 * `initLocale` makes them agree: a formatted date almost always sits inside a
 * translated sentence, so it has to be built from the same value that chose the
 * words around it. `resolveLocale` is also memoized for the lifetime of the
 * page, which would make this cache impossible to invalidate.
 *
 * Construction is the expensive part of `Intl`, so instances are cached — keyed
 * by locale and time zone as well as options, so a language or zone change can
 * never be served a formatter built for the one before it.
 */
const formatters = new Map<string, Intl.DateTimeFormat>()

export function getDateFormatter(
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const locale = getLocale()
  // The account's zone, not the machine's — see src/lib/time-zone.ts. When it
  // is absent the key stays out of the options object entirely, so `Intl`
  // applies its own browser default rather than being handed an `undefined`.
  const timeZone = getActiveTimeZone()
  const key = `${locale}:${timeZone ?? ''}:${JSON.stringify(options)}`

  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(
      locale,
      timeZone ? { ...options, timeZone } : options,
    )
    formatters.set(key, formatter)
  }

  return formatter
}

/** Formats a date, returning `''` for values that aren't real dates. */
export function formatDate(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  if (value === null || value === undefined) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return getDateFormatter(options).format(date)
}

/**
 * The calendar day an instant falls on *in the account's zone*, as
 * `YYYY-MM-DD`.
 *
 * `Date`'s own getters read the machine's zone, so anything that decides which
 * day something happened — day headings, per-day grouping — has to come through
 * here instead. `en-CA` is used because it formats in exactly that shape, which
 * sorts lexicographically and parses back without a locale-specific reader; the
 * strings it produces are keys, never anything shown to a person.
 */
const dayKeyFormat = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
} as const

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>()

export function getCalendarDayKey(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const timeZone = getActiveTimeZone()
  const cacheKey = timeZone ?? ''

  let formatter = dayKeyFormatters.get(cacheKey)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(
      'en-CA',
      timeZone ? { ...dayKeyFormat, timeZone } : dayKeyFormat,
    )
    dayKeyFormatters.set(cacheKey, formatter)
  }

  return formatter.format(date)
}

/**
 * Whole calendar days between two instants as the account's zone counts them.
 * Positive when `from` is the later day, which is what "how many days ago"
 * asks. Comparing days rather than subtracting milliseconds is what makes
 * 23:50 and 00:10 read as different days instead of as twenty minutes.
 */
export function calendarDaysBetween(
  from: string | number | Date,
  to: string | number | Date,
): number {
  const fromKey = getCalendarDayKey(from)
  const toKey = getCalendarDayKey(to)
  if (!fromKey || !toKey) return 0

  // Read back as UTC midnights purely so they can be subtracted: both sides
  // came from the same zone, so the offset cancels and only the day gap is
  // left. DST never enters into it — these are calendar labels, not instants.
  const fromUtc = Date.parse(`${fromKey}T00:00:00Z`)
  const toUtc = Date.parse(`${toKey}T00:00:00Z`)

  return Math.round((fromUtc - toUtc) / 86_400_000)
}

/**
 * The hour of the day (0–23) an instant falls in, in the account's zone.
 *
 * For anything that greets or schedules by the time of day: `getHours()` would
 * answer from the machine's clock, which is how a Berlin account signing in
 * from Singapore gets wished good morning at eleven at night.
 */
const hourFormat = { hour: '2-digit', hour12: false } as const

const hourFormatters = new Map<string, Intl.DateTimeFormat>()

export function getCalendarHour(value: string | number | Date = Date.now()): number {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 0

  const timeZone = getActiveTimeZone()
  const cacheKey = timeZone ?? ''

  let formatter = hourFormatters.get(cacheKey)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(
      'en-GB',
      timeZone ? { ...hourFormat, timeZone } : hourFormat,
    )
    hourFormatters.set(cacheKey, formatter)
  }

  // `en-GB` with `hour12: false` renders midnight as '24' rather than '00' in
  // some runtimes, which would put the small hours in the wrong bucket.
  return Number.parseInt(formatter.format(date), 10) % 24
}
