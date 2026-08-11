import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import type { QuoteMetadata } from '../../schemas/message-metadata'
import { listPreviewFromMessage } from '../../schemas/message-metadata'
import { useMessageThreadContext } from './message-thread-context'

type Props = {
  quote: QuoteMetadata | null
  /** Internal parent row id when resolved — enables scroll-to-parent. */
  replyToMessageId: string | null
}

/**
 * The quoted parent above a reply's own content. A 2px rule marks it as
 * someone else's words: a filled plate here would be a box inside the bubble,
 * and the transcript has exactly one plate per message already.
 *
 * The loaded parent outranks the channel's quote payload — an inbound quote
 * often carries only an external id, and a reply composed in this app carries
 * no payload at all, which is what used to leave "Quoted message" standing in
 * for text that was two rows up the transcript. Clicking scrolls to the
 * parent; without a loaded parent there is nothing to scroll to, so the strip
 * is inert rather than a control that silently does nothing.
 */
export function MessageReplyPreview({ quote, replyToMessageId }: Props) {
  const thread = useMessageThreadContext()
  const parent = replyToMessageId
    ? (thread?.messagesById.get(replyToMessageId) ?? null)
    : null

  const author = parent
    ? parent.direction === 'outbound'
      ? m.inbox_reply_quote_you()
      : thread?.contactName || null
    : (quote?.author_name ?? null)
  const preview = parent
    ? listPreviewFromMessage(parent)
    : (quote?.preview ?? null)

  const handleClick = () => {
    if (!parent) return
    document
      .getElementById(`message-${parent.id}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!parent}
      className={cn(
        'mb-1.5 flex w-full min-w-0 flex-col gap-px border-l-2 border-current/30 py-px pl-2 text-left text-sm',
        parent &&
          'cursor-pointer transition-colors duration-150 hover:border-current/70 motion-reduce:transition-none',
      )}
    >
      {/* An unknown author is left unstated rather than labelled: a system
          string in the author slot reads as a person named "Quoted message".
          The quoted text alone already says what is being replied to. */}
      {author ? (
        <span className="truncate font-semibold opacity-90">{author}</span>
      ) : null}
      {/* opacity-70 floor: below it the quoted text composites onto the bubble
          fill at under 4.5:1 in light mode (0.6 -> 4.33, 0.55 -> 3.74). */}
      {preview ? <span className="truncate opacity-70">{preview}</span> : null}
      {!author && !preview ? (
        <span className="truncate italic opacity-70">
          {m.inbox_reply_quoted_message()}
        </span>
      ) : null}
    </button>
  )
}
