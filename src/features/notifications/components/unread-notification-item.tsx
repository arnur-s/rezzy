import { listItemStyle } from '@/components/list'
import { NumericUnreadChip } from '@/components/numeric-unread-chip'
import { PlatformIcon, isChannelType } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import { FormattedMessageText } from '@/features/inbox/components/formatted-message-text'
import { formatRelativeShort } from '@/features/inbox/utils/relative-time'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { cn } from '@/lib/cn'

type Props = {
  conversation: ConversationWithRelations
  /** Rendered only for agents with more than one workspace. */
  workspaceName?: string | null
  onSelect: (conversation: ConversationWithRelations) => void
}

/** Compact unread conversation row inside the header notifications popover. */
export function UnreadNotificationItem({
  conversation,
  workspaceName = null,
  onSelect,
}: Props) {
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
    workspaceName,
    m.inbox_unread_aria_label({ count: unreadCount }),
    timestamp,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(conversation)}
        aria-label={itemLabel}
        className={cn(
          // px-2.5 inside the list's 6px gutter puts the avatar on the same
          // 16px axis as the popover title.
          'flex w-full cursor-pointer items-start gap-3 rounded-xl px-2.5 py-2 text-left outline-none',
          listItemStyle.transition,
          listItemStyle.hover,
          listItemStyle.focus,
        )}
      >
        <div className="relative shrink-0">
          <Avatar
            size="md"
            name={conversation.contact.name ?? undefined}
            src={conversation.contact.avatar_url ?? undefined}
          />
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
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">
              {contactName}
            </span>
            <span className="text-secondary shrink-0 text-xs tabular-nums">
              {timestamp}
            </span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <FormattedMessageText
              as="span"
              content={conversation.last_message_preview?.trim() ?? ''}
              variant="preview"
              className="block min-w-0 flex-1 truncate text-primary/80"
            />
            <NumericUnreadChip
              count={unreadCount}
              capAt99
              aria-label={m.inbox_unread_aria_label({ count: unreadCount })}
            />
          </div>
          {workspaceName ? (
            <span className="text-secondary mt-0.5 block truncate text-xs">
              {workspaceName}
            </span>
          ) : null}
        </div>
      </button>
    </li>
  )
}
