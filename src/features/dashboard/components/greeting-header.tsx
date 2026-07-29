import { useMyIdentity } from '@/features/account'
import { m } from '@/paraglide/messages'
import { getTimeOfDayGreeting } from '../utils/get-time-of-day-greeting'

/**
 * The page's h1: one line, salutation first. The avatar lives in the TopNav.
 *
 * The name comes from the profile row rather than from the auth user, so
 * renaming yourself on the profile page changes the greeting too. Auth metadata
 * is frozen at sign-up, which made this the most visible place in the product
 * still addressing people by a name they had already changed.
 */
export function GreetingHeader() {
  const greeting = getTimeOfDayGreeting()
  const { displayName } = useMyIdentity()

  return (
    <h1 className="text-primary truncate text-lg leading-tight font-semibold">
      {displayName
        ? m.home_greeting_line({ greeting, name: displayName })
        : greeting}
    </h1>
  )
}
