import { m } from '@/paraglide/messages'
import { Spinner } from '@heroui/react'

type Props = {
  isFetchingOlder: boolean
}

/**
 * Pagination spinner shown at the top of the transcript while an older page
 * loads. Absolutely positioned inside the virtualizer's start padding so it
 * never contributes to scroll geometry (which must stay owned by the
 * virtualizer's measurements alone).
 */
export function LoadOlderMessagesRegion({ isFetchingOlder }: Props) {
  if (!isFetchingOlder) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-1 flex justify-center"
      role="status"
      aria-live="polite"
    >
      <Spinner size="sm" className="text-muted" />
      <span className="sr-only">{m.inbox_messages_loading_older()}</span>
    </div>
  )
}
