import { m } from '@/paraglide/messages'
import { cn } from '@/lib/cn'
import { CircleOffIcon } from 'lucide-react'
import type { UnsupportedMetadata } from '../../schemas/message-metadata'

type Props = {
  unsupported: UnsupportedMetadata | null
  messageType: 'unsupported' | 'system'
  isOutbound: boolean
}

/**
 * Explicit fallback for provider payloads Rezzy cannot render (polls, orders,
 * unknown types) and provider service events. The raw event is preserved
 * server-side; ordinary users only see this safe summary.
 */
export function MessageUnsupported({ unsupported, messageType, isOutbound }: Props) {
  const label =
    messageType === 'system'
      ? m.inbox_message_type_system()
      : m.inbox_unsupported_message()

  return (
    <div className="flex items-start gap-2 p-0.5 text-sm">
      <CircleOffIcon className="mt-0.5 size-4 shrink-0 opacity-60" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            'italic',
            isOutbound ? 'text-on-accent/80' : 'text-primary/70',
          )}
        >
          {label}
        </span>
        {unsupported?.preview ? (
          <span
            className={cn(
              'truncate text-xs',
              isOutbound ? 'text-on-accent/70' : 'text-primary/55',
            )}
          >
            {unsupported.preview}
          </span>
        ) : null}
      </span>
    </div>
  )
}
