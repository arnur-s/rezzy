import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { useState } from 'react'
import { FormattedMessageText } from '../formatted-message-text'

/** Above this, a message is clamped behind a "Show more" toggle. */
const LONG_MESSAGE_CHARS = 1400
const LONG_MESSAGE_LINES = 18

function isLongMessage(content: string): boolean {
  if (content.length > LONG_MESSAGE_CHARS) return true
  let lines = 1
  for (const char of content) {
    if (char === '\n') lines++
    if (lines > LONG_MESSAGE_LINES) return true
  }
  return false
}

type Props = {
  content: string
  className?: string
}

/**
 * A pasted log or a wall of text should not own the whole viewport. Long
 * messages collapse to a readable height with a fade and an explicit toggle;
 * short ones render straight through with no wrapper cost.
 */
export function MessageCollapsibleText({ content, className }: Props) {
  const [expanded, setExpanded] = useState(false)
  const long = isLongMessage(content)

  const text = (
    <FormattedMessageText content={content} variant="bubble" className={className} />
  )

  if (!long) return text

  return (
    <div className="flex flex-col items-start">
      <div
        className={cn(
          'w-full',
          // Fade the text's own alpha rather than paint over it, so the clamp
          // reads correctly on any bubble background in either theme.
          !expanded &&
            'max-h-80 overflow-hidden mask-[linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]',
        )}
      >
        {text}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="text-secondary hover:text-primary mt-1 text-xs font-medium underline-offset-2 hover:underline"
      >
        {expanded ? m.inbox_message_show_less() : m.inbox_message_show_more()}
      </button>
    </div>
  )
}
