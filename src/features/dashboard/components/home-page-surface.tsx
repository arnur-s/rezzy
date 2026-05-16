import { cn } from '@heroui/styles'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export function HomePageSurface({ children, className }: Props) {
  return (
    <div
      className={cn(
        'flex-1 border-border bg-card text-card-foreground shadow-surface rounded-xl border p-5 md:p-8',
        'space-y-8',
        className,
      )}
    >
      {children}
    </div>
  )
}
