import { m } from '@/paraglide/messages'
import { Button } from '@heroui/react'
import { cn } from '@heroui/styles'
import { useState } from 'react'

type Props = {
  /** The (possibly truncated) preview body. */
  body: string
  /** The full message text, when longer than the preview. */
  fullText: string | null
  /** Whether the full message is longer than the shown body. */
  truncated: boolean
  className?: string
}

/**
 * Two-line message preview with an optional "Show full message" expansion when
 * the message is longer than the preview.
 */
export function NotificationPreview({
  body,
  fullText,
  truncated,
  className,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const canExpand = truncated && Boolean(fullText)
  const text = expanded && fullText ? fullText : body

  if (!text) return null

  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      <p
        className={cn(
          'text-sm leading-snug text-foreground/80',
          expanded
            ? 'max-h-40 overflow-y-auto whitespace-pre-wrap wrap-break-word'
            : 'line-clamp-2',
        )}
      >
        {text}
      </p>
      {canExpand && !expanded ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-0 text-xs font-medium text-foreground/70 transition-colors hover:text-foreground"
          onPress={() => setExpanded(true)}
        >
          {m.notifications_show_full_message()}
        </Button>
      ) : null}
    </div>
  )
}
