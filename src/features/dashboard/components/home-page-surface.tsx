import { Surface } from '@heroui/react'
import { cn } from '@heroui/styles'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export function HomePageSurface({ children, className }: Props) {
  return (
    <Surface
      variant="transparent"
      className={cn('container flex-1 md:p-8', 'space-y-8', className)}
    >
      {children}
    </Surface>
  )
}
