import { m } from '@/paraglide/messages'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const diff = Math.max(0, now - then)
  if (diff < MINUTE_MS) return m.dashboard_relative_just_now()
  if (diff < HOUR_MS) {
    return m.dashboard_relative_minutes({ count: Math.floor(diff / MINUTE_MS) })
  }
  if (diff < DAY_MS) {
    return m.dashboard_relative_hours({ count: Math.floor(diff / HOUR_MS) })
  }
  return m.dashboard_relative_days({ count: Math.floor(diff / DAY_MS) })
}
