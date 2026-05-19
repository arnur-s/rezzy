import { m } from '@/paraglide/messages'

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

/** Local clock: night 22–4, morning 5–11, afternoon 12–17, evening 18–21. */
export function getTimeOfDay(date = new Date()): TimeOfDay {
  const hour = date.getHours()
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
