import { PlatformIcon, isChannelType } from '@/entities/channel'
import { formatRelativeShort } from '@/features/inbox/utils/relative-time'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Button } from '@astryxdesign/core/Button'
import type { ShowToastFn } from '@astryxdesign/core/Toast'
import { BellIcon } from 'lucide-react'
import type {
  MessageNotificationDetails,
  MessagePreviewMode,
} from '../model/types'
import type { NotificationTarget } from '../utils/notification-navigation'
import { buildNotificationPreview } from '../utils/notification-preview'
import { NotificationPreview } from './notification-preview'

type Props = {
  details: MessageNotificationDetails
  previewMode: MessagePreviewMode
  onOpen: () => void
}

/** Rich in-app notification body rendered inside an Astryx toast. */
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
          <Avatar
            size="md"
            name={contactName ?? undefined}
            src={conversation.contact.avatar_url ?? undefined}
          />
          {channelType ? (
            <PlatformIcon
              type={channelType}
              size="xs"
              withPlate
              className="ring-surface absolute -right-1 -bottom-1 ring-2"
            />
          ) : null}
        </div>
      ) : (
        <span className="bg-muted text-secondary flex size-10 shrink-0 items-center justify-center rounded-3xl">
          <BellIcon className="size-5" aria-hidden />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Reserve trailing space so the timestamp clears the toast's close
            button pinned to the top-right. */}
        <div className="flex items-baseline gap-2 pe-6 sm:pe-2">
          <span className="text-primary min-w-0 flex-1 truncate text-sm font-semibold">
            {preview.title}
          </span>
          <span className="text-secondary shrink-0 text-xs tabular-nums">
            {formatRelativeShort(details.createdAt)}
          </span>
        </div>

        {workspaceName ? (
          <span className="bg-muted text-primary max-w-full self-start truncate rounded-full px-2 py-0.5 text-xs font-medium">
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
          <Button
            label={m.notifications_open_thread()}
            size="sm"
            variant="primary"
            onClick={onOpen}
          />
        </div>
      </div>
    </div>
  )
}

export type ShowMessageNotificationOptions = {
  details: MessageNotificationDetails
  previewMode: MessagePreviewMode
  onOpen: (target: NotificationTarget) => void
  /** Obtained from `useToast()` in the calling hook. */
  showToast: ShowToastFn
}

/**
 * Show a message notification as an Astryx toast. Repeated messages for the same
 * conversation replace the previous toast via `uniqueID` + `collisionBehavior`,
 * so notifications never stack uncontrollably.
 */
export function showMessageNotificationToast({
  details,
  previewMode,
  onOpen,
  showToast,
}: ShowMessageNotificationOptions): void {
  // Captured so the "Open" action can dismiss the toast it lives inside.
  const holder: { dismiss: () => void } = { dismiss: () => {} }

  const handleOpen = () => {
    onOpen({
      workspaceId: details.workspaceId,
      conversationId: details.conversationId,
    })
    holder.dismiss()
  }

  holder.dismiss = showToast({
    body: (
      <MessageNotification
        details={details}
        previewMode={previewMode}
        onOpen={handleOpen}
      />
    ),
    type: 'info',
    uniqueID: details.conversationId,
    collisionBehavior: 'overwrite',
    autoHideDuration: 8000,
  })
}
