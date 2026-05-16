import { m } from '@/paraglide/messages'
import { Link as HeroLink, Text } from '@heroui/react'
import { cn } from '@heroui/styles'
import { Link as RouterLink } from '@tanstack/react-router'

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <Text className="text-center text-4xl font-bold">
        {m.not_found_title()}
      </Text>
      <Text className="text-center text-lg text-muted-foreground">
        {m.not_found_description()}
      </Text>
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
