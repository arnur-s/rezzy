import { NumericUnreadChip } from '@/components/numeric-unread-chip'
import { PlatformIcon, isChannelType } from '@/entities/channel'
import {
  ConversationStatusChip,
  isConversationStatus,
} from '@/entities/conversation'
import type { ConversationWithRelations } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { cn } from '@heroui/styles'
import { FormattedMessageText } from '../formatted-message-text'
import { formatRelativeShort } from '../../utils/relative-time'

type Props = {
  conversation: ConversationWithRelations
  isActive: boolean
}

export function ConversationListItem({
  conversation,
  isActive,
}: Props) {
  const channelType = isChannelType(conversation.channel.type)
    ? conversation.channel.type
    : null
  const status = isConversationStatus(conversation.status)
    ? conversation.status
    : null
  const rawUnreadCount = Math.max(0, conversation.unread_count)
  const visibleUnreadCount = isActive ? 0 : rawUnreadCount
  const isUnread = visibleUnreadCount > 0
  const contactName = conversation.contact.name?.trim() || '—'
  const preview = conversation.last_message_preview?.trim()

  return (
    <>
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
              isUnread
                ? 'font-semibold text-foreground'
                : 'font-medium text-foreground/90',
            )}
          >
            {contactName}
          </span>
          <span className="shrink-0 text-[11px] text-foreground/50">
            {formatRelativeShort(conversation.last_message_at)}
          </span>
        </div>

        <div className="mt-0.5 flex items-baseline gap-2">
          <FormattedMessageText
            as="span"
            content={preview ?? ''}
            variant="preview"
            className={cn(
              'block min-w-0 flex-1 truncate',
              isUnread ? 'text-foreground/80' : 'text-foreground/55',
            )}
          />
          {isUnread ? (
            <NumericUnreadChip
              count={visibleUnreadCount}
              flat={isActive}
              aria-label={m.inbox_unread_aria_label({
                count: visibleUnreadCount,
              })}
            />
          ) : null}
        </div>

        {status ? (
          <div className="mt-1.5">
            <ConversationStatusChip status={status} size="sm" />
          </div>
        ) : null}
      </div>
    </>
  )
}
