import { cn } from '@/lib/cn'

/**
 * The dashboard's one loading placeholder.
 *
 * Home previously had three: Astryx's `Skeleton` in the summary line, a
 * hand-rolled `bg-primary/5 animate-pulse` list in the attention and workspace
 * sections, and an inline pulse span in the single-workspace summary. Three
 * pulses on one page is three different claims about what "loading" looks like,
 * which is exactly the drift the design system's restraint is meant to prevent.
 *
 * Always `aria-hidden`: a placeholder has nothing to announce, and the sections
 * that use it already carry their own headings.
 */

type SkeletonProps = {
  className?: string
}

export function DashboardSkeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('bg-primary/5 block animate-pulse rounded-md', className)}
    />
  )
}

type SkeletonRowsProps = {
  /** How many placeholder rows to reserve. */
  count: number
  /** Height of one row, matched to the real row it stands in for. */
  rowClassName?: string
  className?: string
}

/**
 * A list's worth of placeholders, reserving the vertical space the real rows
 * will occupy so the sections below do not jump when the data lands.
 */
export function DashboardSkeletonRows({
  count,
  rowClassName = 'h-12',
  className,
}: SkeletonRowsProps) {
  return (
    <ul aria-hidden="true" className={cn('space-y-2', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <li key={index}>
          <DashboardSkeleton className={cn('w-full', rowClassName)} />
        </li>
      ))}
    </ul>
  )
}
