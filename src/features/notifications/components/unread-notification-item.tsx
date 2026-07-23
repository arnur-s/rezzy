import { listItemStyle } from '@/components/list'
import { NumericUnreadChip } from '@/components/numeric-unread-chip'
import { PlatformIcon, isChannelType } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import { FormattedMessageText } from '@/features/inbox/components/formatted-message-text'
import { formatRelativeShort } from '@/features/inbox/utils/relative-time'
import { m } from '@/paraglide/messages'
import { Avatar } from '@heroui/react'
import { cn } from '@heroui/styles'
import { initialsFromName } from '../utils/initials'

type Props = {
  conversation: ConversationWithRelations
  onSelect: (conversationId: string) => void
}

/** Compact unread conversation row inside the header notifications popover. */
export function UnreadNotificationItem({ conversation, onSelect }: Props) {
  const contactName = conversation.contact.name?.trim() || '—'
  const channelType = isChannelType(conversation.channel.type)
    ? conversation.channel.type
    : null
  const unreadCount = Math.max(0, conversation.unread_count)
  const timestamp = formatRelativeShort(conversation.last_message_at)
  // Announce the action, the count, and the time in one label; the row's
  // visual children stay decorative for assistive technology.
  const itemLabel = [
    m.notifications_item_open_aria({ name: contactName }),
    m.inbox_unread_aria_label({ count: unreadCount }),
    timestamp,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        aria-label={itemLabel}
        className={cn(
          'flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-left outline-none',
          listItemStyle.transition,
          listItemStyle.hover,
          listItemStyle.focus,
        )}
      >
        <div className="relative shrink-0">
          <Avatar size="md">
            {conversation.contact.avatar_url ? (
              <Avatar.Image src={conversation.contact.avatar_url} />
            ) : null}
            <Avatar.Fallback>
              {initialsFromName(conversation.contact.name)}
            </Avatar.Fallback>
          </Avatar>
          {channelType ? (
            <PlatformIcon
              type={channelType}
              size="xs"
              withPlate
              className="absolute -right-1 -bottom-1 ring-2 ring-surface"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {contactName}
            </span>
            <span className="shrink-0 text-[11px] text-foreground/50 tabular-nums">
              {timestamp}
            </span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <FormattedMessageText
              as="span"
              content={conversation.last_message_preview?.trim() ?? ''}
              variant="preview"
              className="block min-w-0 flex-1 truncate text-foreground/80"
            />
            <NumericUnreadChip
              count={unreadCount}
              capAt99
              aria-label={m.inbox_unread_aria_label({ count: unreadCount })}
            />
          </div>
        </div>
      </button>
    </li>
  )
}
