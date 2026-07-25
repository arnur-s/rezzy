import type { Channel } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { useToast } from '@astryxdesign/core/Toast'
import { useActivateChannel } from '../hooks/use-channels'

type Props = {
  channel: Channel
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

export function ActivateChannelDialog({
  channel,
  isOpen,
  onOpenChange,
  workspaceId,
}: Props) {
  const showToast = useToast()
  const activateChannelMutation = useActivateChannel(workspaceId)

  function handleConfirm() {
    activateChannelMutation.mutate(channel.id, {
      onError: (error) => {
        showToast({
          body:
            error instanceof Error ? error.message : m.common_unknown_error(),
          type: 'error',
        })
      },
      onSuccess: () => {
        showToast({ body: m.channels_activate_success(), type: 'info' })
        onOpenChange(false)
      },
    })
  }

  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={m.channels_activate_confirm_title()}
      description={m.channels_activate_confirm_description({
        name: channel.name ?? channel.type,
      })}
      actionLabel={m.channels_activate_action()}
      onAction={handleConfirm}
      cancelLabel={m.common_cancel()}
      actionVariant="primary"
      isActionLoading={activateChannelMutation.isPending}
    />
  )
}
