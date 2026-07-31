import type { HomeStats } from '@/features/dashboard/api/home-stats'
import { m } from '@/paraglide/messages'
import { DashboardSkeleton } from '@/features/dashboard/components/dashboard-skeleton'
import { SectionError } from '@/features/dashboard/components/section-error'
import { cn } from '@/lib/cn'
import { CheckIcon } from 'lucide-react'

type Segment = {
  key: string
  text: string
  emphasized?: boolean
}

type Props = {
  stats: HomeStats | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
  isRetrying?: boolean
  /**
   * Open conversations nobody has claimed. The all-clear is about the
   * reader's own plate, so without this it can announce calm directly above
   * a list of customers no one is helping.
   */
  unassignedCount?: number
}

/**
 * The personal numbers as separate operational states under the greeting.
 * Zeros do not render; the all-clear collapses to a single line; loading and
 * failure are their own honest states instead of fake zeros.
 *
 * The segments are text, deliberately. They were briefly links, which was
 * worse than either alternative: four differently-worded doors that all opened
 * the same unfiltered inbox is a promise broken on every click. Until the inbox
 * can be addressed by filter in its URL, one honest door (the header button)
 * beats four misleading ones, and the reading order stays greeting, situation,
 * action.
 *
 * Each segment also states its own threshold. The horizons used to live in
 * `title` attributes, which are invisible on touch, unreachable by keyboard,
 * and unreliably announced on a non-interactive span, so the numbers that most
 * needed defining were the ones nobody could read.
 */
export function HomeSummaryLine({
  stats,
  isPending,
  isError,
  onRetry,
  isRetrying = false,
  unassignedCount = 0,
}: Props) {
  if (isPending) {
    return (
      <div className="flex h-5 items-center">
        <DashboardSkeleton className="h-4 w-70 max-w-full" />
      </div>
    )
  }

  if (isError || !stats) {
    return <SectionError message={m.home_summary_error()} onRetry={onRetry} isRetrying={isRetrying} />
  }

  const segments: Array<Segment> = []
  if (stats.unreadAssigned > 0) {
    segments.push({
      key: 'unread',
      text: m.home_summary_unread({ count: stats.unreadAssigned }),
      emphasized: true,
    })
  }
  if (stats.openAssigned > 0) {
    segments.push({
      key: 'open',
      text: m.home_summary_open({ count: stats.openAssigned }),
    })
  }
  if (stats.snoozedWaking > 0) {
    segments.push({
      key: 'waking',
      text: m.home_summary_waking({ count: stats.snoozedWaking }),
    })
  }
  if (stats.staleAssigned > 0) {
    segments.push({
      key: 'stale',
      text: m.home_summary_stale({ count: stats.staleAssigned }),
    })
  }

  if (segments.length === 0) {
    // "Всё разобрано" is true of this reader and false of the team when
    // conversations are sitting unclaimed. Say the narrower thing, and drop
    // the celebratory check with it: a green tick over unclaimed customers
    // is the wrong feeling even when the words are technically correct.
    if (unassignedCount > 0) {
      return (
        <p className="text-secondary text-sm">
          {m.home_summary_all_clear_unassigned({ count: unassignedCount })}
        </p>
      )
    }

    return (
      <p className="flex items-center gap-2 text-sm">
        <span
          aria-hidden="true"
          className="bg-success/12 text-success flex size-5 shrink-0 items-center justify-center rounded-full"
        >
          <CheckIcon className="size-3" />
        </span>
        <span className="text-secondary">{m.home_summary_all_clear()}</span>
      </p>
    )
  }

  return (
    // Spacing carries the separation. Dotted segments stacked up to four
    // middots on a busy morning, which read as decoration rather than rhythm.
    <p className="text-secondary flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {segments.map((segment) => (
        <span
          key={segment.key}
          className={cn(
            'tabular-nums',
            segment.emphasized && 'text-primary font-semibold',
          )}
        >
          {segment.text}
        </span>
      ))}
    </p>
  )
}
