import type { HomeStats } from '@/features/dashboard/api/home-stats'
import { m } from '@/paraglide/messages'
import { DashboardSkeleton } from '@/features/dashboard/components/dashboard-skeleton'
import { SectionError } from '@/features/dashboard/components/section-error'
import { cn } from '@/lib/cn'
import { Link } from '@tanstack/react-router'
import { CheckIcon } from 'lucide-react'

type Segment = {
  key: string
  text: string
  hint?: string
  emphasized?: boolean
}

type Props = {
  stats: HomeStats | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
  isRetrying?: boolean
  /**
   * Where a segment goes when clicked. Null before any workspace exists, in
   * which case the segments stay plain text rather than inventing a door.
   */
  inboxWorkspaceId?: string | null
}

/**
 * The personal numbers as separate operational states under the greeting.
 * Zeros do not render; the all-clear collapses to a single line; loading and
 * failure are their own honest states instead of fake zeros.
 *
 * The segments are links, not labels. As inert text they restated what the
 * attention list already showed in full one section below, costing a reading
 * pass for strictly less information. As doors they earn the line: the summary
 * is the accelerator, the list is the detail.
 */
export function HomeSummaryLine({
  stats,
  isPending,
  isError,
  onRetry,
  isRetrying = false,
  inboxWorkspaceId = null,
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
      hint: m.home_attention_reason_unread_hint(),
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
      hint: m.home_summary_waking_hint(),
    })
  }
  if (stats.staleAssigned > 0) {
    segments.push({
      key: 'stale',
      text: m.home_summary_stale({ count: stats.staleAssigned }),
      hint: m.home_summary_stale_hint(),
    })
  }

  if (segments.length === 0) {
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
        <SummarySegment
          key={segment.key}
          segment={segment}
          inboxWorkspaceId={inboxWorkspaceId}
        />
      ))}
    </p>
  )
}

function SummarySegment({
  segment,
  inboxWorkspaceId,
}: {
  segment: Segment
  inboxWorkspaceId: string | null
}) {
  const className = cn(
    'tabular-nums',
    segment.emphasized && 'text-primary font-semibold',
  )

  if (!inboxWorkspaceId) {
    return (
      <span title={segment.hint} aria-label={getSegmentLabel(segment)} className={className}>
        {segment.text}
      </span>
    )
  }

  return (
    <Link
      to="/workspaces/$id/inbox"
      params={{ id: inboxWorkspaceId }}
      title={segment.hint}
      // The hint used to be reachable only by hovering. Folding it into the
      // accessible name means keyboard and screen-reader users get the
      // definition the sighted mouse user gets.
      aria-label={getSegmentLabel(segment)}
      className={cn(
        className,
        'rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent',
      )}
    >
      {segment.text}
    </Link>
  )
}

function getSegmentLabel(segment: Segment): string {
  return segment.hint ? `${segment.text}. ${segment.hint}` : segment.text
}
