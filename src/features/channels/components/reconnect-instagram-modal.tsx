import { Button } from '@/components/button'
import type { Channel } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { AlertDialog, Modal } from '@heroui/react'
import { TriangleAlertIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConnectInstagramForm } from './connect-instagram-form'

type Props = {
  channel: Channel
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

export function ReconnectInstagramModal({
  channel,
  isOpen,
  onOpenChange,
  workspaceId,
}: Props) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isConfirmingClose, setIsConfirmingClose] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setHasUnsavedChanges(false)
      setIsConfirmingClose(false)
    }
  }, [isOpen])

  function handleOpenChange(open: boolean) {
    if (!open && hasUnsavedChanges) {
      setIsConfirmingClose(true)
      return
    }
    onOpenChange(open)
  }

  function confirmDiscard() {
    setIsConfirmingClose(false)
    onOpenChange(false)
  }

  return (
    <>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
        <Modal.Container>
          <Modal.Dialog
            aria-label={m.channels_instagram_reconnect_title()}
            className="sm:max-w-140"
          >
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {m.channels_instagram_reconnect_title()}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="-mx-2 px-2">
              {isOpen && (
                <ConnectInstagramForm
                  target={{
                    kind: 'reconnect',
                    workspaceId,
                    channelId: channel.id,
                  }}
                  onCancel={() => handleOpenChange(false)}
                  onDirtyChange={setHasUnsavedChanges}
                  onSuccess={() => onOpenChange(false)}
                />
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <AlertDialog.Backdrop
        isOpen={isConfirmingClose}
        onOpenChange={setIsConfirmingClose}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning">
                <TriangleAlertIcon />
              </AlertDialog.Icon>
              <AlertDialog.Heading>
                {m.channels_instagram_reconnect_discard_title()}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-muted">
                {m.channels_instagram_reconnect_discard_description()}
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                variant="secondary"
                onClick={() => setIsConfirmingClose(false)}
              >
                {m.channels_connect_discard_cancel()}
              </Button>
              <Button variant="danger" onPress={confirmDiscard}>
                {m.channels_connect_discard_confirm()}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  )
}
