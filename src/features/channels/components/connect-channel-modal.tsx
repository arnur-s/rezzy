import { Button } from '@/components/button'
import type { ChannelType } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { AlertDialog, Modal } from '@heroui/react'
import { TriangleAlertIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConnectChannelComingSoon } from './connect-channel-coming-soon'
import { ConnectChannelPicker } from './connect-channel-picker'
import { ConnectTelegramForm } from './connect-telegram-form'
import { ConnectWhatsapp } from './connect-whatsapp'

type Props = {
  workspaceId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectChannelModal({
  workspaceId,
  isOpen,
  onOpenChange,
}: Props) {
  const [type, setType] = useState<ChannelType | null>(null)
  // Tracks whether the active step holds unsaved input. Every content step that
  // can lose data should report this via `onDirtyChange` so the close
  // confirmation below applies to future channel types too, not just Telegram.
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isConfirmingClose, setIsConfirmingClose] = useState(false)

  // Start every session on the channel picker, regardless of how the modal
  // was last dismissed.
  useEffect(() => {
    if (isOpen) {
      setType(null)
    }
  }, [isOpen])

  function backToPicker() {
    setType(null)
  }

  // Intercept dismiss requests (backdrop, Esc, close button). If the current
  // step has unsaved input, ask for confirmation instead of closing right away.
  function handleOpenChange(open: boolean) {
    if (!open && hasUnsavedChanges) {
      setIsConfirmingClose(true)
      return
    }
    onOpenChange(open)
  }

  // Confirmed discard: close both the confirmation and the modal.
  function confirmDiscard() {
    setIsConfirmingClose(false)
    onOpenChange(false)
  }

  return (
    <>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
        <Modal.Container>
          <Modal.Dialog
            aria-label={m.channels_connect_title()}
            className="sm:max-w-[560px]"
          >
            <Modal.CloseTrigger />

            <Modal.Header>
              <Modal.Heading>{m.channels_connect_title()}</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="-mx-2 px-2">
              {type === null ? (
                <ConnectChannelPicker onSelect={setType} />
              ) : type === 'telegram' ? (
                <ConnectTelegramForm
                  workspaceId={workspaceId}
                  onCancel={backToPicker}
                  onDirtyChange={setHasUnsavedChanges}
                  // Successful creation closes directly, skipping the discard
                  // confirmation since there is nothing left to lose.
                  onSuccess={() => onOpenChange(false)}
                />
              ) : type === 'whatsapp' ? (
                <ConnectWhatsapp
                  target={{ kind: 'create', workspaceId }}
                  onCancel={backToPicker}
                  onDirtyChange={setHasUnsavedChanges}
                  onSuccess={() => onOpenChange(false)}
                />
              ) : (
                <ConnectChannelComingSoon type={type} onCancel={backToPicker} />
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
                {m.channels_connect_discard_title()}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-muted-foreground">
                {m.channels_connect_discard_description()}
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
