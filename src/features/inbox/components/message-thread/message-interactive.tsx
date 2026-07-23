import { m } from '@/paraglide/messages'
import { cn } from '@heroui/styles'
import { MousePointerClickIcon } from 'lucide-react'
import type { InteractiveMetadata } from '../../schemas/message-metadata'

type Props = {
  interactive: InteractiveMetadata
  isOutbound: boolean
}

/** Interactive reply (button tap / list selection) with its selection context. */
export function MessageInteractive({ interactive, isOutbound }: Props) {
  return (
    <div className="flex items-start gap-2 p-0.5 text-sm">
      <MousePointerClickIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            'text-xs',
            isOutbound ? 'text-accent-foreground/75' : 'text-foreground/60',
          )}
        >
          {interactive.kind === 'list_reply'
            ? m.inbox_interactive_list_reply()
            : m.inbox_interactive_button_reply()}
        </span>
        <span className="font-medium">{interactive.title ?? interactive.id}</span>
        {interactive.description ? (
          <span
            className={cn(
              'text-xs',
              isOutbound ? 'text-accent-foreground/75' : 'text-foreground/60',
            )}
          >
            {interactive.description}
          </span>
        ) : null}
      </span>
    </div>
  )
}
