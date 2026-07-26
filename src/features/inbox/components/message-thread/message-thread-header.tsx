import { PLATFORM_META, PlatformIcon, isChannelType } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { IconButton } from '@astryxdesign/core/IconButton'
import { cn } from '@/lib/cn'
import { ArrowLeftIcon, InfoIcon } from 'lucide-react'
import { MessageThreadStatusActions } from './message-thread-status-actions'

type Props = {
  conversation: ConversationWithRelations
  workspaceId: string
  onToggleContactPanel: () => void
  onBack?: () => void
}

export function MessageThreadHeader({
  conversation,
  workspaceId,
  onToggleContactPanel,
  onBack,
}: Props) {
  const channelType = isChannelType(conversation.channel.type)
    ? conversation.channel.type
    : null
  const contactName = conversation.contact.name?.trim() || '—'
  const channelLabel = channelType
    ? PLATFORM_META[channelType].labelKey()
    : conversation.channel.name?.trim() || ''

  return (
    <header className="border-border/60 flex h-16 w-full shrink-0 items-center gap-3 border-b px-3 py-3 sm:px-6">
      {onBack ? (
        <span className="md:hidden">
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onBack}
            label={m.inbox_thread_back_to_list()}
            icon={<ArrowLeftIcon className="size-4" />}
          />
        </span>
      ) : null}

      <span className="shrink-0">
        <Avatar size="md" name={contactName} />
      </span>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold text-primary">
          {contactName}
        </h2>
        {/* Channel, phone, and assignee are separated by space, not dots: with
            all three present the row carried two middots of pure decoration. */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-primary/70">
          {channelType ? <PlatformIcon type={channelType} size="sm" /> : null}
          <span className={cn('-ml-1', channelType && 'text-primary')}>
            {channelLabel}
          </span>
          {conversation.contact.phone ? (
            <span className="truncate">{conversation.contact.phone}</span>
          ) : null}
          {conversation.assigned_profile ? (
            <span className="truncate">
              {m.inbox_assigned_to({
                name: conversation.assigned_profile.full_name,
              })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <MessageThreadStatusActions
          workspaceId={workspaceId}
          conversationId={conversation.id}
          status={conversation.status}
        />
        <IconButton
          variant="ghost"
          size="sm"
          onClick={onToggleContactPanel}
          label={m.inbox_thread_show_contact()}
          icon={<InfoIcon className="size-4" />}
        />
      </div>
    </header>
  )
}
