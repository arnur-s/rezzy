import { Skeleton } from '@heroui/react'

const ROWS = [
  { width: 'w-56', side: 'left' },
  { width: 'w-40', side: 'right' },
  { width: 'w-72', side: 'left' },
  { width: 'w-32', side: 'right' },
  { width: 'w-60', side: 'left' },
] as const

export function MessageThreadSkeleton() {
  return (
    <div
      className="container flex w-full flex-col gap-3 px-4 py-6 sm:px-6"
      aria-hidden
    >
      {ROWS.map((row, index) => (
        <div
          key={index}
          className={
            row.side === 'right' ? 'flex justify-end' : 'flex justify-start'
          }
        >
          <Skeleton className={`h-12 rounded-2xl ${row.width}`} />
        </div>
      ))}
    </div>
  )
}
