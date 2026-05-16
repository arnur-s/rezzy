import { m } from '@/paraglide/messages'
import { Spinner } from '@heroui/react'
import type { RefObject } from 'react'

type Props = {
  sentinelRef: RefObject<HTMLDivElement | null>
  isFetchingOlder: boolean
  hasMoreOlder: boolean
}

export function LoadOlderMessagesRegion({
  sentinelRef,
  isFetchingOlder,
  hasMoreOlder,
}: Props) {
  if (!hasMoreOlder && !isFetchingOlder) return null

  return (
    <div className="flex shrink-0 flex-col items-center gap-2 py-3">
      {isFetchingOlder ? (
        <div
          className="flex items-center gap-2 text-muted"
          role="status"
          aria-live="polite"
        >
          <Spinner size="sm" />
          <span className="sr-only">{m.inbox_messages_loading_older()}</span>
        </div>
      ) : null}
      <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden />
    </div>
  )
}
