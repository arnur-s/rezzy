import { m } from '@/paraglide/messages'
import type { User } from '@supabase/supabase-js'
import { getTimeOfDayGreeting } from '../utils/get-time-of-day-greeting'

type Props = {
  user: User
}

/** The page's h1: one line, salutation first. The avatar lives in the TopNav. */
export function GreetingHeader({ user }: Props) {
  const greeting = getTimeOfDayGreeting()
  const displayName = getDisplayName(user)

  return (
    <h1 className="text-primary truncate text-lg leading-tight font-semibold">
      {displayName
        ? m.home_greeting_line({ greeting, name: displayName })
        : greeting}
    </h1>
  )
}

function getDisplayName(user: User): string | null {
  const fullName = user.user_metadata.full_name
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim()
  const name = user.user_metadata.name
  if (typeof name === 'string' && name.trim()) return name.trim()
  if (user.email) return user.email.split('@')[0] || null
  return null
}
