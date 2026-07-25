import type { MessageReactionRow } from '@/entities/message'
import { cn } from '@/lib/cn'
import { useMemo } from 'react'

type Props = {
  reactions: Array<MessageReactionRow>
  isOutbound: boolean
}

/** Custom-emoji reactions arrive as opaque provider ids; render a fallback. */
function displayEmoji(emoji: string): string {
  return emoji.startsWith('custom:') ? '💠' : emoji
}

/** Emoji chips with counts, shown under the bubble like major messengers. */
export function MessageReactionsRow({ reactions, isOutbound }: Props) {
  const grouped = useMemo(() => {
    const counts = new Map<string, number>()
    for (const reaction of reactions) {
      const key = displayEmoji(reaction.emoji)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries())
  }, [reactions])

  if (grouped.length === 0) return null

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1',
        isOutbound ? 'justify-end' : 'justify-start',
      )}
    >
      {grouped.map(([emoji, count]) => (
        <span
          key={emoji}
          className="inline-flex items-center gap-0.5 rounded-full bg-primary/8 px-1.5 py-0.5 text-xs shadow-xs"
        >
          <span>{emoji}</span>
          {count > 1 ? (
            <span className="text-xs text-primary/60">{count}</span>
          ) : null}
        </span>
      ))}
    </div>
  )
}
