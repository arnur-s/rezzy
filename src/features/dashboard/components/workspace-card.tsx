import { CHANNEL_META } from '@/entities/channel'
import type { ChannelType } from '@/entities/channel'
import { formatRelativeTime } from '@/features/dashboard/utils/format-relative-time'
import { WorkspaceIcon } from '@/entities/workspace'
import type { Workspace } from '@/entities/workspace'
import type { WorkspaceDashboardStats } from '@/features/dashboard/api/dashboard-stats'
import { m } from '@/paraglide/messages'
import { NumericUnreadChip } from '@/components/numeric-unread-chip'
import { Card } from '@astryxdesign/core/Card'
import { cn } from '@/lib/cn'
import { Link } from '@tanstack/react-router'

type Props = {
  workspace: Workspace
  /** Null when workspace activity failed to load — the card stays a navigation
      target and simply omits numbers instead of showing confident zeros. */
  stats: Omit<WorkspaceDashboardStats, 'workspaceId'> | null
}

export function WorkspaceCard({ workspace, stats }: Props) {
  const hasUnread = stats !== null && stats.unread > 0

  return (
    <Link
      to="/workspaces/$id"
      params={{ id: workspace.id }}
      aria-label={workspace.name}
      className={cn(
        'group rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-accent',
        'hover:-translate-y-0.5 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0',
      )}
    >
      <Card variant="default" height="100%">
      <div className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="bg-accent-bg/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold"
          >
            <WorkspaceIcon name={workspace.icon} className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">
              {workspace.name}
            </p>
            {workspace.description ? (
              <p className="text-secondary line-clamp-1 text-xs">
                {workspace.description}
              </p>
            ) : null}
          </div>
        </div>
        {hasUnread ? (
          <NumericUnreadChip
            count={stats.unread}
            tone="primary"
            capAt99
            aria-label={m.dashboard_workspace_card_unread_aria({
              count: stats.unread,
            })}
          />
        ) : null}
      </div>

      {stats ? (
        <div className="mt-3 space-y-3">
          {/* Spacing separates the three counts; a dot between each turned the
              row into punctuation soup. */}
          <p className="text-secondary flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm tabular-nums">
            <span>{m.dashboard_workspace_card_open({ count: stats.open })}</span>
            <span>
              {m.dashboard_workspace_card_channels({ count: stats.channels })}
            </span>
            <span>
              {m.dashboard_workspace_card_contacts({ count: stats.contacts })}
            </span>
          </p>

          <div className="flex items-center justify-between gap-2">
            <ChannelTypeRow types={stats.channelTypes} />
            <span className="text-secondary truncate text-xs">
              {stats.lastMessageAt
                ? m.dashboard_workspace_card_last_message({
                    when: formatRelativeTime(stats.lastMessageAt),
                  })
                : m.dashboard_workspace_card_no_activity()}
            </span>
          </div>
        </div>
      ) : null}
      </Card>
    </Link>
  )
}

function ChannelTypeRow({ types }: { types: Array<ChannelType> }) {
  if (types.length === 0) {
    return <span aria-hidden="true" className="size-6" />
  }

  return (
    <div className="flex items-center gap-1">
      {types.map((type) => {
        const meta = CHANNEL_META[type]
        const Icon = meta.icon
        return (
          <span
            key={type}
            aria-hidden="true"
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
