import { AppButton } from '@/components/app-button'
import { m } from '@/paraglide/messages'
import { AlertDialog, Button, toast } from '@heroui/react'
import { TriangleAlertIcon } from 'lucide-react'
import { useDeleteChannel } from '../hooks/use-channels'
import type { Channel } from '../types'

type Props = {
  channel: Channel
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

export function DeleteChannelDialog({
  channel,
  isOpen,
  onOpenChange,
  workspaceId,
}: Props) {
  const deleteChannelMutation = useDeleteChannel(workspaceId)

  function handleConfirm() {
    deleteChannelMutation.mutate(channel.id, {
      onError: (error) => {
        toast.danger(m.channels_disconnect_error_title(), {
          description:
            error instanceof Error
              ? error.message
              : m.common_unknown_error(),
        })
      },
      onSuccess: () => {
        toast.success(m.channels_disconnect_success())
        onOpenChange(false)
      },
    })
  }

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger">
              <TriangleAlertIcon />
            </AlertDialog.Icon>
            <AlertDialog.Heading>
              {m.channels_disconnect_confirm_title()}
            </AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p className="text-sm text-muted-foreground">
              {m.channels_disconnect_confirm_description({
                name: channel.name ?? channel.type,
              })}
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              isDisabled={deleteChannelMutation.isPending}
            >
              {m.common_cancel()}
            </Button>
            <AppButton
              variant="danger"
              isLoading={deleteChannelMutation.isPending}
              onPress={handleConfirm}
            >
              {m.channels_disconnect_action()}
            </AppButton>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
