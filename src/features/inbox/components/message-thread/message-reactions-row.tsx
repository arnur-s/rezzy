import type { MessageReactionRow } from '@/entities/message'
import { displayReactionEmoji, groupMessageReactions } from '@/entities/message'
import { cn } from '@/lib/cn'
import { useMemo } from 'react'

type Props = {
  reactions: Array<MessageReactionRow>
  isOutbound: boolean
}

/**
 * Emoji chips with counts, shown under the bubble like major messengers. The
 * counts are derived from the reaction records themselves, so a re-delivered
 * event cannot inflate one.
 */
export function MessageReactionsRow({ reactions, isOutbound }: Props) {
  const grouped = useMemo(() => groupMessageReactions(reactions), [reactions])

  if (grouped.length === 0) return null

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1',
        isOutbound ? 'justify-end' : 'justify-start',
      )}
    >
      {grouped.map((group) => (
        <span
          key={group.emoji}
          className={cn(
            'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-sm shadow-xs',
            // Our own reaction is marked, not merely counted: without it the
            // agent cannot tell a chip they can withdraw from one they cannot.
            group.reactedByCurrentUser
              ? 'bg-primary/12 ring-primary/30 ring-1'
              : 'bg-primary/8',
          )}
        >
          <span>{displayReactionEmoji(group.emoji)}</span>
          {group.count > 1 ? (
            <span className="text-sm text-primary/60">{group.count}</span>
          ) : null}
        </span>
      ))}
    </div>
  )
}
