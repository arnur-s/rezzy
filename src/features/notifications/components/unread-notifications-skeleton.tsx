import { Skeleton } from '@heroui/react'

/** Mirrors the unread-notification row layout while conversations load. */
export function UnreadNotificationsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-0.5 px-1.5 pb-1.5">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex items-start gap-3 rounded-xl px-3 py-2.5">
          <Skeleton className="size-10 shrink-0 rounded-3xl" />
          <div className="min-w-0 flex-1 space-y-2 py-1">
            <Skeleton className="h-3.5 w-2/3 rounded" />
            <Skeleton className="h-3 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
