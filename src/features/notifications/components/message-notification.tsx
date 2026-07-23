import { PlatformIcon, isChannelType } from '@/entities/channel'
import { formatRelativeShort } from '@/features/inbox/utils/relative-time'
import { m } from '@/paraglide/messages'
import { Avatar, Button, toast } from '@heroui/react'
import { BellIcon } from 'lucide-react'
import type {
  MessageNotificationDetails,
  MessagePreviewMode,
} from '../model/types'
import { initialsFromName } from '../utils/initials'
import type { NotificationTarget } from '../utils/notification-navigation'
import { buildNotificationPreview } from '../utils/notification-preview'
import { NotificationPreview } from './notification-preview'

type Props = {
  details: MessageNotificationDetails
  previewMode: MessagePreviewMode
  onOpen: () => void
}

/** Rich in-app notification body rendered inside a HeroUI toast. */
export function MessageNotification({ details, previewMode, onOpen }: Props) {
  const { conversation, message, workspaceName } = details
  const contactName = conversation.contact.name
  const preview = buildNotificationPreview({ contactName, message, previewMode })
  const channelType = isChannelType(conversation.channel.type)
    ? conversation.channel.type
    : null
  const showContactVisuals = previewMode !== 'hidden'
  const fullText =
    previewMode === 'full' ? (message.content?.trim() || null) : null

  return (
    <div className="flex w-full items-start gap-3">
      {showContactVisuals ? (
        <div className="relative shrink-0">
          <Avatar size="md">
            {conversation.contact.avatar_url ? (
              <Avatar.Image src={conversation.contact.avatar_url} />
            ) : null}
            <Avatar.Fallback>{initialsFromName(contactName)}</Avatar.Fallback>
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
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-3xl bg-default text-muted">
          <BellIcon className="size-5" aria-hidden />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Reserve trailing space so the timestamp clears the close button
            HeroUI pins to the top-right: always-visible on touch (wider gap),
            hover-only and corner-tucked on desktop (narrower gap). */}
        <div className="flex items-baseline gap-2 pe-6 sm:pe-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {preview.title}
          </span>
          <span className="shrink-0 text-[11px] text-foreground/50 tabular-nums">
            {formatRelativeShort(details.createdAt)}
          </span>
        </div>

        {workspaceName ? (
          <span className="max-w-full self-start truncate rounded-full bg-default px-2 py-0.5 text-[11px] font-medium text-default-foreground">
            {workspaceName}
          </span>
        ) : null}

        {preview.body ? (
          <NotificationPreview
            body={preview.body}
            fullText={fullText}
            truncated={preview.truncated}
          />
        ) : null}

        <div className="mt-1.5">
          <Button size="sm" variant="primary" onPress={onOpen}>
            {m.notifications_open_thread()}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Tracks the active toast per conversation so repeats replace rather than stack. */
const activeToastByConversation = new Map<string, string>()

export type ShowMessageNotificationOptions = {
  details: MessageNotificationDetails
  previewMode: MessagePreviewMode
  onOpen: (target: NotificationTarget) => void
}

/**
 * Show a message notification as a HeroUI toast. Repeated messages for the same
 * conversation replace the previous toast instead of stacking uncontrollably.
 */
export function showMessageNotificationToast({
  details,
  previewMode,
  onOpen,
}: ShowMessageNotificationOptions): void {
  const previousId = activeToastByConversation.get(details.conversationId)
  if (previousId) toast.close(previousId)

  const holder: { id: string } = { id: '' }
  const dismiss = () => {
    if (holder.id) toast.close(holder.id)
  }
  const handleOpen = () => {
    onOpen({
      workspaceId: details.workspaceId,
      conversationId: details.conversationId,
    })
    dismiss()
  }

  holder.id = toast(
    <MessageNotification
      details={details}
      previewMode={previewMode}
      onOpen={handleOpen}
    />,
    {
      timeout: 8000,
      // Our body renders its own contact avatar; suppress HeroUI's default
      // info-circle indicator so it doesn't sit beside it.
      indicator: null,
      onClose: () => {
        if (activeToastByConversation.get(details.conversationId) === holder.id) {
          activeToastByConversation.delete(details.conversationId)
        }
      },
    },
  )

  activeToastByConversation.set(details.conversationId, holder.id)
}
