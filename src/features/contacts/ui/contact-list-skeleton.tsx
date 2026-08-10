import { Skeleton } from '@astryxdesign/core/Skeleton'

/**
 * Loading placeholder shared by all three directory views (live, archived,
 * duplicates) while their respective query is pending.
 */
export function ContactListSkeleton() {
  return (
    <div className="flex flex-col gap-0.5 px-2 py-2" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton width={32} height={32} radius={3} />
          <div className="flex-1">
            <Skeleton width="40%" height={14} radius={3} />
          </div>
        </div>
      ))}
    </div>
  )
}
