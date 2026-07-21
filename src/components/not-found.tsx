import { m } from '@/paraglide/messages'
import { Link as HeroLink, Typography } from '@heroui/react'
import { cn } from '@heroui/styles'
import { Link as RouterLink } from '@tanstack/react-router'

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 w-full h-full">
      <Typography className="text-center text-4xl font-bold">
        {m.not_found_title()}
      </Typography>
      <Typography className="text-center text-lg text-muted">
        {m.not_found_description()}
      </Typography>
      <HeroLink
        href="/"
        render={({ className, children }) => (
          <RouterLink to="/" className={cn(className)}>
            {children}
          </RouterLink>
        )}
      >
        {m.not_found_go_home_link()}
      </HeroLink>
    </div>
  )
}
