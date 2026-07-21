import { CHANNEL_META } from '@/entities/channel'
import type { ChannelType } from '@/entities/channel'
import { formatRelativeTime } from '@/features/dashboard/utils/format-relative-time'
import { resolveWorkspaceIcon } from '@/entities/workspace'
import type { Workspace } from '@/entities/workspace'
import { m } from '@/paraglide/messages'
import { NumericUnreadChip } from '@/components/numeric-unread-chip'
import { Card } from '@heroui/react'
import { cn } from '@heroui/styles'
import { Link } from '@tanstack/react-router'
import { DynamicIcon } from 'lucide-react/dynamic'

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
  const hasUnread = unread > 0

  return (
    <Link
      to="/workspaces/$id"
      params={{ id: workspace.id }}
      aria-label={workspace.name}
      className={cn(
        'group rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-focus',
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
              className="bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold"
            >
              <DynamicIcon
                name={resolveWorkspaceIcon(workspace.icon)}
                className="size-4"
              />
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
            <NumericUnreadChip
              count={unread}
              tone="primary"
              capAt99
              aria-label={m.dashboard_workspace_card_unread_aria({
                count: unread,
              })}
            />
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
