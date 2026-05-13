import { Skeleton } from '@heroui/react'

export function ConversationListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-start gap-3 rounded-xl px-3 py-2.5"
        >
          <Skeleton className="size-9 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
