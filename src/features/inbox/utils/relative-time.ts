import {
  calendarDaysBetween,
  getCalendarDayKey,
  getDateFormatter,
} from '@/lib/format-date'
import { m } from '@/paraglide/messages'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

// Resolved per call rather than at module load: `getDateFormatter` caches the
// instance, and the app locale is not settled when this module first evaluates.
const shortDateFormat = { day: 'numeric', month: 'short' } as const
const dayHeadingFormat = { day: 'numeric', month: 'long' } as const

/** Short relative timestamp suitable for the conversation list. */
export function formatRelativeShort(input: string | Date | null): string {
  if (!input) return ''
  const date = typeof input === 'string' ? new Date(input) : input
  const diff = Date.now() - date.getTime()

  if (diff < MINUTE) {
    return m.inbox_relative_now()
  }
  if (diff < HOUR) {
    return m.inbox_relative_minutes({ count: Math.floor(diff / MINUTE) })
  }

  // Past the hour mark the answer stops being an elapsed duration and becomes
  // a position on the account's calendar: 00:30 is "yesterday" to someone
  // whose day has already turned over, however few hours ago it was.
  const daysAgo = calendarDaysBetween(Date.now(), date)

  if (daysAgo === 0) {
    return m.inbox_relative_hours({ count: Math.floor(diff / HOUR) })
  }
  if (daysAgo === 1) {
    return m.inbox_relative_yesterday()
  }
  return getDateFormatter(shortDateFormat).format(date)
}

/** Returns "Today" / "Yesterday" / "12 May" used between message groups. */
export function formatDayHeading(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  const diffDays = calendarDaysBetween(Date.now(), date)

  if (diffDays === 0) return m.inbox_day_today()
  if (diffDays === 1) return m.inbox_day_yesterday()
  return getDateFormatter(dayHeadingFormat).format(date)
}

/**
 * Stable per-day key (YYYY-MM-DD) for grouping, in the account's zone so a
 * transcript breaks where the reader's day breaks rather than where their
 * laptop's does.
 */
export function dayKey(input: string | Date): string {
  return getCalendarDayKey(input)
}

const timeFormat = { hour: '2-digit', minute: '2-digit' } as const

export function formatTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  return getDateFormatter(timeFormat).format(date)
}
