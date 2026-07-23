import { m } from '@/paraglide/messages'
import { cn } from '@heroui/styles'
import type { QuoteMetadata } from '../../schemas/message-metadata'

type Props = {
  quote: QuoteMetadata | null
  /** Internal parent row id when resolved — enables scroll-to-parent. */
  replyToMessageId: string | null
  isOutbound: boolean
}

/**
 * Compact quoted-reply strip above the bubble content. Clicking scrolls to the
 * parent bubble when it is rendered in the transcript (bubbles carry DOM ids).
 */
export function MessageReplyPreview({ quote, replyToMessageId, isOutbound }: Props) {
  const preview = quote?.preview ?? null
  const author = quote?.author_name ?? null

  const handleClick = () => {
    if (!replyToMessageId) return
    document
      .getElementById(`message-${replyToMessageId}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!replyToMessageId}
      className={cn(
        'mb-1 flex w-full min-w-0 flex-col rounded-lg border-l-2 px-2 py-1 text-left text-xs',
        isOutbound
          ? 'border-accent-foreground/50 bg-accent-foreground/10 text-accent-foreground/85'
          : 'border-accent/60 bg-foreground/5 text-foreground/70',
        replyToMessageId && 'cursor-pointer hover:opacity-80',
      )}
    >
      <span className="font-medium">{author ?? m.inbox_reply_quoted_message()}</span>
      {preview ? <span className="truncate">{preview}</span> : null}
    </button>
  )
}
