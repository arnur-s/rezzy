import { Skeleton } from '@astryxdesign/core/Skeleton'

export function ConversationListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex items-start gap-3 rounded-xl px-3 py-2.5">
          <span className="shrink-0">
            <Skeleton width={36} height={36} radius={3} />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton width="66%" height={14} radius={2} />
            <Skeleton width="100%" height={12} radius={2} />
            <Skeleton width={64} height={16} radius="rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
