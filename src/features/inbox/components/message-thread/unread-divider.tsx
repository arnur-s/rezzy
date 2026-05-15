import { m } from '@/paraglide/messages'
import { Chip } from '@heroui/react'
import { cn } from '@heroui/styles'

type Props = {
  className?: string
}

export function UnreadDivider({ className }: Props) {
  return (
    <div className={cn('flex items-center gap-3 py-1', className)}>
      <div className="h-px flex-1 bg-border/70" />
      <Chip color="accent" size="sm" variant="soft">
        {m.inbox_unread_messages_divider()}
      </Chip>
      <div className="h-px flex-1 bg-border/70" />
    </div>
  )
}
