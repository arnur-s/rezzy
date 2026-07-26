import { NumericUnreadChip } from '@/components/numeric-unread-chip'
import { PlatformIcon, isChannelType } from '@/entities/channel'
import {
  ConversationStatusChip,
  isConversationStatus,
} from '@/entities/conversation'
import type { ConversationWithRelations } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { cn } from '@/lib/cn'
import { memo } from 'react'
import { FormattedMessageText } from '../formatted-message-text'
import { formatRelativeShort } from '../../utils/relative-time'

type Props = {
  conversation: ConversationWithRelations
  isActive: boolean
}

function ConversationListItemImpl({
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
                ? 'font-semibold text-primary'
                : 'font-medium text-primary/90',
            )}
          >
            {contactName}
          </span>
          {/* `text-secondary` rather than an alpha step of `text-primary`: the
              alpha ramp composites ink onto parchment in light mode and lands
              at 3.4:1, while the same alpha on the ink page passes. Only the
              semantic token is tuned per mode. */}
          <span className="text-secondary shrink-0 text-xs">
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
              isUnread ? 'text-primary/80' : 'text-secondary',
            )}
          />
          {isUnread ? (
            <NumericUnreadChip
              count={visibleUnreadCount}
              aria-label={m.inbox_unread_aria_label({
                count: visibleUnreadCount,
              })}
            />
          ) : null}
        </div>

        {status ? (
          <div className="mt-1.5">
            <ConversationStatusChip status={status} />
          </div>
        ) : null}
      </div>
    </>
  )
}

export const ConversationListItem = memo(ConversationListItemImpl)
