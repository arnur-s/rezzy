import { CHANNEL_META } from '@/entities/channel'
import type { ChannelType } from '@/entities/channel'
import { WorkspaceIcon } from '@/entities/workspace'
import type { Workspace } from '@/entities/workspace'
import type { WorkspaceDashboardStats } from '@/features/dashboard/api/dashboard-stats'
import { SectionError } from '@/features/dashboard/components/section-error'
import { formatRelativeTime } from '@/features/dashboard/utils/format-relative-time'
import { m } from '@/paraglide/messages'
import { cn } from '@/lib/cn'
import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'

type Props = {
  workspace: Workspace
  /** Null when workspace activity failed to load — the summary stays a
      navigation target and simply omits numbers instead of showing zeros. */
  stats: Omit<WorkspaceDashboardStats, 'workspaceId'> | null
  statsPending: boolean
  statsError: boolean
  onRetryStats: () => void
  isRetryingStats?: boolean
  onCreate: () => void
}

/**
 * The one-workspace replacement for the grid: a compact row that navigates to
 * the workspace, with creating another workspace demoted to a quiet ghost
 * button beside the section title. The link and the button are siblings, never
 * nested.
 */
export function SingleWorkspaceSummary({
  workspace,
  stats,
  statsPending,
  statsError,
  onRetryStats,
  isRetryingStats = false,
  onCreate,
}: Props) {
  return (
    <section aria-labelledby="home-workspace-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="home-workspace-title"
          className="text-primary text-sm font-semibold"
        >
          {m.home_workspace_section_title()}
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Link
            to="/workspaces/$id/settings"
            params={{ id: workspace.id }}
            className="text-secondary hover:bg-primary/4 hover:text-primary rounded-md px-2 py-1.5 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
          >
            {m.home_workspace_manage()}
          </Link>
          <Button
            label={m.dashboard_empty_cta()}
            variant="ghost"
            size="sm"
            onClick={onCreate}
          />
        </div>
      </div>

      {statsError ? (
        <SectionError
          message={m.home_workspaces_stats_error()}
          onRetry={onRetryStats}
          isRetrying={isRetryingStats}
        />
      ) : null}

      <Link
        to="/workspaces/$id"
        params={{ id: workspace.id }}
        aria-label={workspace.name}
        className={cn(
          '-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 outline-none',
          'transition hover:bg-primary/4 active:scale-[0.98]',
          'focus-visible:ring-2 focus-visible:ring-accent',
          'motion-reduce:transition-none',
        )}
      >
        <span
          aria-hidden="true"
          className="bg-accent-bg/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-md"
        >
          <WorkspaceIcon name={workspace.icon} className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2">
            <span className="text-primary truncate text-sm font-semibold">
              {workspace.name}
            </span>
            {workspace.description ? (
              <span className="text-secondary hidden min-w-0 truncate text-xs sm:inline">
                {workspace.description}
              </span>
            ) : null}
          </p>
          {workspace.description ? (
            <p className="text-secondary mt-0.5 line-clamp-1 text-xs sm:hidden">
              {workspace.description}
            </p>
          ) : null}
          {statsPending ? (
            <span
              aria-hidden="true"
              className="bg-primary/5 mt-1 block h-4 w-56 max-w-full animate-pulse rounded"
            />
          ) : stats ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-secondary flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs tabular-nums">
                <span>{m.dashboard_workspace_card_open({ count: stats.open })}</span>
                <span>
                  {m.dashboard_workspace_card_channels({ count: stats.channels })}
                </span>
                <span>
                  {m.dashboard_workspace_card_contacts({ count: stats.contacts })}
                </span>
                <span className="truncate">
                  {stats.lastMessageAt
                    ? m.dashboard_workspace_card_last_message({
                        when: formatRelativeTime(stats.lastMessageAt),
                      })
                    : m.dashboard_workspace_card_no_activity()}
                </span>
              </p>
              {stats.channelTypes.length > 0 ? (
                <ChannelTypeRow types={stats.channelTypes} />
              ) : null}
            </div>
          ) : null}
        </div>

        <ChevronRightIcon
          aria-hidden="true"
          className="text-secondary/70 size-4 shrink-0"
        />
      </Link>
    </section>
  )
}

function ChannelTypeRow({ types }: { types: Array<ChannelType> }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-1">
      {types.map((type) => {
        const meta = CHANNEL_META[type]
        const Icon = meta.icon
        return (
          <span
            key={type}
            className={cn(
              'flex size-6 items-center justify-center rounded-md',
              meta.iconBackgroundClassName,
            )}
          >
            <Icon className={cn('size-3.5', meta.iconClassName)} />
          </span>
        )
      })}
    </div>
  )
}
