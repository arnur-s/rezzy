import type { HomeStats } from '@/features/dashboard/api/home-stats'
import { m } from '@/paraglide/messages'
import { SectionError } from '@/features/dashboard/components/section-error'
import { cn } from '@/lib/cn'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { Link } from '@tanstack/react-router'
import { ArrowRightIcon, CheckIcon } from 'lucide-react'

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
  /** Present when the user has exactly one workspace, so the line can offer a direct door. */
  inboxWorkspaceId: string | null
}

/**
 * The personal numbers as one quiet sentence under the greeting. Zeros do not
 * render; the all-clear collapses to a single line; loading and failure are
 * their own honest states instead of fake zeros.
 */
export function HomeSummaryLine({
  stats,
  isPending,
  isError,
  onRetry,
  isRetrying = false,
  inboxWorkspaceId,
}: Props) {
  if (isPending) {
    return (
      <div aria-hidden="true" className="flex h-5 items-center">
        <Skeleton width={280} height={16} radius={2} />
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
          className="bg-success-soft text-success flex size-5 shrink-0 items-center justify-center rounded-full"
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
          title={segment.hint}
          className={cn(
            'tabular-nums',
            segment.emphasized && 'text-primary font-semibold',
          )}
        >
          {segment.text}
        </span>
      ))}
      {inboxWorkspaceId ? (
        <Link
          to="/workspaces/$id/inbox"
          params={{ id: inboxWorkspaceId }}
          className="text-primary inline-flex items-center gap-1 font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
        >
          {m.home_open_inbox()}
          <ArrowRightIcon aria-hidden="true" className="size-3.5" />
        </Link>
      ) : null}
    </p>
  )
}
