import { m } from '@/paraglide/messages'
import { cn } from '@heroui/styles'

type Props = {
  className?: string
}

export function UnreadDivider({ className }: Props) {
  const label = m.inbox_unread_messages_divider()

  return (
    <div
      data-unread-divider="true"
      role="separator"
      aria-label={label}
      className={cn('flex items-center gap-3 py-2', className)}
    >
      <div className="h-px min-w-0 flex-1 bg-border/40" aria-hidden />
      <span
        className="shrink-0 text-center text-xs font-medium text-muted-foreground"
        aria-hidden
      >
        {label}
      </span>
      <div className="h-px min-w-0 flex-1 bg-border/40" aria-hidden />
    </div>
  )
}
