import { PLATFORM_META, PlatformIcon, isChannelType } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { IconButton } from '@astryxdesign/core/IconButton'
import { ArrowLeftIcon, InfoIcon } from 'lucide-react'
import { ConversationAssigneeControl } from './conversation-assignee-control'
import { MessageThreadStatusActions } from './message-thread-status-actions'

type Props = {
  conversation: ConversationWithRelations
  workspaceId: string
  /** The signed-in agent, so the assignee menu can offer "assign to me" first. */
  currentUserId: string | null
  onToggleContactPanel: () => void
  onBack?: () => void
}

export function MessageThreadHeader({
  conversation,
  workspaceId,
  currentUserId,
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
    <header className="border-border/60 flex h-14 w-full shrink-0 items-center gap-3 border-b px-3 py-3 sm:px-6">
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
        <Avatar
          size="md"
          name={contactName}
          src={conversation.contact.avatar_url ?? undefined}
        />
      </span>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold text-primary">
          {contactName}
        </h2>
        {/* Channel and phone are separated by space, not dots: with both
            present the row carried a middot of pure decoration. The assignee
            used to sit here too and no longer does — it is the one mutable
            thing in a line of customer facts, and it now lives in the action
            cluster with the other control that routes this thread away. */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-primary/70">
          {channelType ? <PlatformIcon type={channelType} size="sm" /> : null}
          <span className={cn('-ml-1', channelType && 'text-primary')}>
            {channelLabel}
          </span>
          {conversation.contact.phone ? (
            <span className="truncate">{conversation.contact.phone}</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {/* Hidden below `lg`.

            The thread pane is whatever the viewport has left after the rail and
            the conversation list, so at 900px it is about 300px wide and this
            header is already at its limit with a contact, a status action and a
            panel toggle in it. Measured there, the control took the contact's
            own name from "truncated" to "absent" — the title's flex-1 resolved
            to single digits and its metadata line painted over the buttons. A
            control that costs the header its subject is not worth its place in
            the header.

            The assignee is not lost at those widths: every conversation row in
            the list beside it still carries the owner's face. */}
        <span className="hidden lg:flex">
          <ConversationAssigneeControl
            workspaceId={workspaceId}
            conversationId={conversation.id}
            assignedTo={conversation.assigned_to}
            currentUserId={currentUserId}
          />
        </span>
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
