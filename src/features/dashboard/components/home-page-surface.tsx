import { paneStyle } from '@/components/pane'
import { ScrollShadow } from '@heroui/react'
import { cn } from '@heroui/styles'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

/**
 * The home dashboard's pane. Owns its own scrolling, like every other pane in
 * the shell — the workspace area itself does not scroll.
 */
export function HomePageSurface({ children, className }: Props) {
  return (
    <div className={cn(paneStyle.surface, 'h-full w-full')}>
      <ScrollShadow className="min-h-0 flex-1">
        <div
          className={cn(
            'mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 md:px-8 md:py-8',
            className,
          )}
        >
          {children}
        </div>
      </ScrollShadow>
    </div>
  )
}
