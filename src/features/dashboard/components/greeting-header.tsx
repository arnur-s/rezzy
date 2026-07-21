import { m } from '@/paraglide/messages'
import type { User } from '@supabase/supabase-js'
import { getTimeOfDayGreeting } from '../utils/get-time-of-day-greeting'

type Props = {
  user: User
}

export function GreetingHeader({ user }: Props) {
  const displayName = getDisplayName(user)
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U'
  const avatarUrl = (user.user_metadata.avatar_url as string | undefined) ?? null

  return (
    <header className="flex items-center gap-4">
      <span
        aria-hidden="true"
        className="bg-accent/10 text-accent flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-semibold"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          initial
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-base font-semibold leading-tight">
          {displayName}
        </p>
        <p className="text-foreground/55 truncate text-sm leading-tight">
          {getTimeOfDayGreeting()}
        </p>
      </div>
    </header>
  )
}

function getDisplayName(user: User): string {
  const fullName = user.user_metadata.full_name
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim()
  const name = user.user_metadata.name
  if (typeof name === 'string' && name.trim()) return name.trim()
  if (user.email) return user.email.split('@')[0] ?? m.home_greeting_fallback_name()
  return m.home_greeting_fallback_name()
}
