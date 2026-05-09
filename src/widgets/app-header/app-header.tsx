import { SidebarTrigger } from '@/components/sidebar'
import { cn } from '@heroui/styles'

export function AppHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur lg:px-4',
        className,
      )}
    >
      <SidebarTrigger />
    </header>
  )
}
