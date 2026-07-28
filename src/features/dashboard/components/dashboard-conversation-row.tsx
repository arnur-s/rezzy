import { PlatformIcon } from '@/entities/channel'
import type { ChannelType } from '@/entities/channel'
import { List } from '@/components/list'
import { cn } from '@/lib/cn'
import { Link } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  conversationId: string
  workspaceId: string
  contactName: string
  channelType: ChannelType | null
  /** Latest message preview; the line renders a quiet placeholder when absent. */
  preview: string | null
  timestampLabel: string
  workspaceName: string | undefined
  /** Optional status chip rendered beside the contact name (e.g. attention reason). */
  chip?: ReactNode
}

/**
 * One dashboard conversation row: the whole row is a single link into the
 * conversation, with hover/focus states inherited from the shared List styles.
 * Channel icons are decorative — the text carries the meaning.
 */
export function DashboardConversationRow({
  conversationId,
  workspaceId,
  contactName,
  channelType,
  preview,
  timestampLabel,
  workspaceName,
  chip,
}: Props) {
  return (
    <List.Item className="-mx-2">
      <Link
        to="/workspaces/$id/inbox/$conversationId"
        params={{ id: workspaceId, conversationId }}
        className="cursor-pointer"
      >
        {channelType ? (
          <PlatformIcon type={channelType} size="md" withPlate />
        ) : (
          <span aria-hidden="true" className="bg-muted size-9 shrink-0 rounded-xl" />
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            <span className="text-primary min-w-0 flex-1 truncate text-sm font-semibold">
              {contactName}
            </span>
            {chip}
            <span className="text-secondary shrink-0 text-xs tabular-nums">
              {timestampLabel}
            </span>
          </p>
          <p className="mt-0.5 flex items-baseline gap-2 text-xs">
            {/* The preview keeps its slot even when the channel sent none, so
                rows stay the same height and nothing invented fills the gap. */}
            <span
              className={cn(
                'min-w-0 flex-1 truncate',
                preview ? 'text-secondary' : 'text-secondary/60',
              )}
            >
              {preview ?? '\u00A0'}
            </span>
            {workspaceName ? (
              <span className="text-secondary/80 max-w-40 shrink-0 truncate">
                {workspaceName}
              </span>
            ) : null}
          </p>
        </div>

        <ChevronRightIcon
          aria-hidden="true"
          className="text-secondary/70 size-4 shrink-0"
        />
      </Link>
    </List.Item>
  )
}
