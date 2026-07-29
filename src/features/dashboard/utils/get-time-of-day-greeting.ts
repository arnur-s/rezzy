import { getCalendarHour } from '@/lib/format-date'
import { m } from '@/paraglide/messages'

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

/**
 * The account's clock: night 22–4, morning 5–11, afternoon 12–17, evening
 * 18–21.
 *
 * Read through `getCalendarHour` rather than `getHours()` so the greeting
 * follows the zone on the profile. A greeting that contradicts the reader's own
 * window is the most conspicuous way for the app to be wrong about where they
 * are, and it is the first line on the page.
 */
export function getTimeOfDay(date = new Date()): TimeOfDay {
  const hour = getCalendarHour(date)
  if (hour >= 22 || hour < 5) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

export function getTimeOfDayGreeting(date = new Date()): string {
  switch (getTimeOfDay(date)) {
    case 'morning':
      return m.home_greeting_morning()
    case 'afternoon':
      return m.home_greeting_afternoon()
    case 'evening':
      return m.home_greeting_evening()
    case 'night':
      return m.home_greeting_night()
  }
}
