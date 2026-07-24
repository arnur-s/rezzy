import { PLATFORM_META, PlatformIcon, isChannelType } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import { getUserInitials } from '@/entities/user'
import { m } from '@/paraglide/messages'
import { Avatar, Button } from '@heroui/react'
import { cn } from '@heroui/styles'
import { ArrowLeftIcon, InfoIcon } from 'lucide-react'

type Props = {
  conversation: ConversationWithRelations
  onToggleContactPanel: () => void
  onBack?: () => void
}

export function MessageThreadHeader({
  conversation,
  onToggleContactPanel,
  onBack,
}: Props) {
  const channelType = isChannelType(conversation.channel.type)
    ? conversation.channel.type
    : null
  const contactName = conversation.contact.name?.trim() || '—'
  const initials = getUserInitials(contactName)
  const channelLabel = channelType
    ? PLATFORM_META[channelType].labelKey()
    : conversation.channel.name?.trim() || ''

  return (
    <header className="border-border/60 flex h-[64px] w-full shrink-0 items-center gap-3 border-b px-3 py-3 sm:px-6">
      {onBack ? (
        <Button
          variant="ghost"
          isIconOnly
          size="sm"
          onPress={onBack}
          aria-label={m.inbox_thread_back_to_list()}
          className="md:hidden"
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
      ) : null}

      <Avatar size="md" className="shrink-0">
        <Avatar.Fallback>{initials}</Avatar.Fallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold text-foreground">
          {contactName}
        </h2>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-foreground/55">
          {channelType ? <PlatformIcon type={channelType} size="sm" /> : null}
          <span className={cn(channelType && 'text-foreground/70')}>
            {channelLabel}
          </span>
          {conversation.contact.phone ? (
            <>
              <span className="text-foreground/30">·</span>
              <span className="truncate">{conversation.contact.phone}</span>
            </>
          ) : null}
          {conversation.assigned_profile ? (
            <>
              <span className="text-foreground/30">·</span>
              <span className="truncate">
                {m.inbox_assigned_to({
                  name: conversation.assigned_profile.full_name,
                })}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <Button
        variant="ghost"
        isIconOnly
        size="sm"
        onPress={onToggleContactPanel}
        aria-label={m.inbox_thread_show_contact()}
      >
        <InfoIcon className="size-4" />
      </Button>
    </header>
  )
}
