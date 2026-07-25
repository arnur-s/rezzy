import { m } from '@/paraglide/messages'
import { cn } from '@/lib/cn'
import type { QuoteMetadata } from '../../schemas/message-metadata'

type Props = {
  quote: QuoteMetadata | null
  /** Internal parent row id when resolved — enables scroll-to-parent. */
  replyToMessageId: string | null
}

/**
 * Compact quoted-reply strip above the bubble content. Clicking scrolls to the
 * parent bubble when it is rendered in the transcript (bubbles carry DOM ids).
 * Colors derive from currentColor so the strip stays legible inside any bubble
 * variant in both themes.
 */
export function MessageReplyPreview({ quote, replyToMessageId }: Props) {
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
        'bg-current/10 mb-1.5 flex w-full min-w-0 flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left text-xs',
        replyToMessageId && 'cursor-pointer transition-opacity hover:opacity-85',
      )}
    >
      {/* An unknown author is left unstated rather than labelled: a system
          string in the author slot reads as a person named "Quoted message".
          The quoted text alone already says what is being replied to. */}
      {author ? (
        <span className="truncate font-semibold">{author}</span>
      ) : null}
      {preview ? (
        <span className={cn('truncate', author && 'opacity-80')}>{preview}</span>
      ) : null}
      {!author && !preview ? (
        <span className="truncate opacity-80">
          {m.inbox_reply_quoted_message()}
        </span>
      ) : null}
    </button>
  )
}
