import type { ChannelType } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { useEffect, useState } from 'react'
import { ConnectChannelComingSoon } from './connect-channel-coming-soon'
import { ConnectChannelPicker } from './connect-channel-picker'
import { ConnectInstagramForm } from './connect-instagram-form'
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
      <Dialog
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        purpose="form"
        width={560}
      >
        <DialogHeader
          title={m.channels_connect_title()}
          onOpenChange={handleOpenChange}
        />
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
        ) : type === 'instagram' ? (
          <ConnectInstagramForm
            target={{ kind: 'create', workspaceId }}
            onCancel={backToPicker}
            onDirtyChange={setHasUnsavedChanges}
            onSuccess={() => onOpenChange(false)}
          />
        ) : (
          <ConnectChannelComingSoon type={type} onCancel={backToPicker} />
        )}
      </Dialog>

      <AlertDialog
        isOpen={isConfirmingClose}
        onOpenChange={setIsConfirmingClose}
        title={m.channels_connect_discard_title()}
        description={m.channels_connect_discard_description()}
        actionLabel={m.channels_connect_discard_confirm()}
        onAction={confirmDiscard}
        cancelLabel={m.channels_connect_discard_cancel()}
        actionVariant="destructive"
      />
    </>
  )
}
