import { Skeleton } from '@astryxdesign/core/Skeleton'

/** Mirrors the unread-notification row layout while conversations load. */
export function UnreadNotificationsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-0.5 px-1.5 pb-1.5">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex items-start gap-3 rounded-xl px-2.5 py-2">
          <span className="shrink-0">
            {/* 36px matches the row's `md` Avatar, so the list does not jolt
                sideways or downward when the real rows land. */}
            <Skeleton width={36} height={36} radius="rounded" />
          </span>
          <div className="min-w-0 flex-1 space-y-2 py-1">
            <Skeleton width="66%" height={14} radius={2} />
            <Skeleton width="100%" height={12} radius={2} />
          </div>
        </div>
      ))}
    </div>
  )
}
