import { Button } from '@/components/button'
import type { Channel } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { AlertDialog, toast } from '@heroui/react'
import { CircleCheckIcon } from 'lucide-react'
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
  const activateChannelMutation = useActivateChannel(workspaceId)

  function handleConfirm() {
    activateChannelMutation.mutate(channel.id, {
      onError: (error) => {
        toast.danger(m.channels_activate_error_title(), {
          description:
            error instanceof Error ? error.message : m.common_unknown_error(),
        })
      },
      onSuccess: () => {
        toast.success(m.channels_activate_success())
        onOpenChange(false)
      },
    })
  }

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Icon status="success">
              <CircleCheckIcon />
            </AlertDialog.Icon>
            <AlertDialog.Heading>
              {m.channels_activate_confirm_title()}
            </AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p className="text-sm text-muted">
              {m.channels_activate_confirm_description({
                name: channel.name ?? channel.type,
              })}
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              isDisabled={activateChannelMutation.isPending}
            >
              {m.common_cancel()}
            </Button>
            <Button
              variant="primary"
              isLoading={activateChannelMutation.isPending}
              onPress={handleConfirm}
            >
              {m.channels_activate_action()}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
