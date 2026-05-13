import type { ChannelType } from '@/features/channels/types'
import { CHANNEL_META } from '@/features/channels/utils/channel-meta'
import { formatRelativeTime } from '@/features/dashboard/utils/format-relative-time'
import type { Workspace } from '@/features/workspaces/types'
import { m } from '@/paraglide/messages'
import { Card } from '@heroui/react'
import { cn } from '@heroui/styles'
import { Link } from '@tanstack/react-router'

type Props = {
  workspace: Workspace
  unread: number
  open: number
  channels: number
  contacts: number
  channelTypes: Array<ChannelType>
  lastMessageAt: string | null
}

export function WorkspaceCard({
  workspace,
  unread,
  open,
  channels,
  contacts,
  channelTypes,
  lastMessageAt,
}: Props) {
  const initial = workspace.name.trim().charAt(0).toUpperCase() || 'W'
  const hasUnread = unread > 0

  return (
    <Link
      to="/workspaces/$id"
      params={{ id: workspace.id }}
      aria-label={workspace.name}
      className={cn(
        'group rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        'hover:-translate-y-0.5',
      )}
    >
      <Card
        variant="default"
        className="h-full transition group-hover:shadow-md"
      >
        <Card.Header className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold"
            >
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <Card.Title className="truncate text-base">
                {workspace.name}
              </Card.Title>
              {workspace.description ? (
                <Card.Description className="line-clamp-1 text-xs">
                  {workspace.description}
                </Card.Description>
              ) : null}
            </div>
          </div>
          {hasUnread ? (
            <span
              aria-label={m.dashboard_workspace_card_unread_aria({
                count: unread,
              })}
              className="bg-primary text-primary-foreground flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Card.Header>

        <Card.Content className="space-y-3">
          <p className="text-foreground/70 text-sm">
            <span>{m.dashboard_workspace_card_open({ count: open })}</span>
            <span className="text-foreground/30 mx-1.5">·</span>
            <span>
              {m.dashboard_workspace_card_channels({ count: channels })}
            </span>
            <span className="text-foreground/30 mx-1.5">·</span>
            <span>
              {m.dashboard_workspace_card_contacts({ count: contacts })}
            </span>
          </p>

          <div className="flex items-center justify-between gap-2">
            <ChannelTypeRow types={channelTypes} />
            <span className="text-foreground/50 truncate text-xs">
              {lastMessageAt
                ? m.dashboard_workspace_card_last_message({
                    when: formatRelativeTime(lastMessageAt),
                  })
                : m.dashboard_workspace_card_no_activity()}
            </span>
          </div>
        </Card.Content>
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
