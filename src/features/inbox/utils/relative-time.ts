import { getDateFormatter } from '@/lib/format-date'
import { m } from '@/paraglide/messages'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

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
  if (diff < DAY) {
    return m.inbox_relative_hours({ count: Math.floor(diff / HOUR) })
  }
  if (diff < 2 * DAY) {
    return m.inbox_relative_yesterday()
  }
  return getDateFormatter(shortDateFormat).format(date)
}

/** Returns "Today" / "Yesterday" / "12 May" used between message groups. */
export function formatDayHeading(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const diffDays = Math.round((today.getTime() - target.getTime()) / DAY)

  if (diffDays === 0) return m.inbox_day_today()
  if (diffDays === 1) return m.inbox_day_yesterday()
  return getDateFormatter(dayHeadingFormat).format(date)
}

/** Returns a stable per-day key (YYYY-MM-DD) for grouping. */
export function dayKey(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  const y = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${month}-${d}`
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

const timeFormat = { hour: '2-digit', minute: '2-digit' } as const

export function formatTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  return getDateFormatter(timeFormat).format(date)
}
