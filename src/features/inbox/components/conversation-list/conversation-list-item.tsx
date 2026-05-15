import { PlatformIcon, isChannelType } from '@/entities/channel'
import {
  ConversationStatusChip,
  isConversationStatus,
} from '@/entities/conversation'
import type { ConversationWithRelations } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { cn } from '@heroui/styles'
import { formatRelativeShort } from '../../utils/relative-time'

type Props = {
  conversation: ConversationWithRelations
  isActive: boolean
  onSelect: (conversationId: string) => void
}

export function ConversationListItem({
  conversation,
  isActive,
  onSelect,
}: Props) {
  const channelType = isChannelType(conversation.channel.type)
    ? conversation.channel.type
    : null
  const status = isConversationStatus(conversation.status)
    ? conversation.status
    : null
  const isUnread = conversation.unread_count > 0
  const contactName = conversation.contact.name?.trim() || '—'
  const preview = conversation.last_message_preview?.trim()

  return (
    <button
      type="button"
      aria-selected={isActive}
      onClick={() => onSelect(conversation.id)}
      className={cn(
        'group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'bg-accent/10'
          : 'hover:bg-foreground/5',
      )}
    >
      {channelType ? (
        <PlatformIcon type={channelType} size="md" withPlate />
      ) : (
        <span className="size-9 shrink-0 rounded-xl bg-muted" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm',
              isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/90',
            )}
          >
            {contactName}
          </span>
          <span className="shrink-0 text-[11px] text-foreground/50">
            {formatRelativeShort(conversation.last_message_at)}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-xs',
              isUnread ? 'text-foreground/80' : 'text-foreground/55',
            )}
          >
            {preview || ' '}
          </span>
          {isUnread ? (
            <span
              aria-label={m.inbox_unread_aria_label({
                count: conversation.unread_count,
              })}
              className="inline-flex min-w-4 shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-accent-foreground"
            >
              {conversation.unread_count}
            </span>
          ) : null}
        </div>

        {status ? (
          <div className="mt-1.5">
            <ConversationStatusChip status={status} size="sm" />
          </div>
        ) : null}
      </div>
    </button>
  )
}
