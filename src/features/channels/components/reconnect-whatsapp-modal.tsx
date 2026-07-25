import type { Channel } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { useEffect, useState } from 'react'
import { ConnectWhatsapp } from './connect-whatsapp'

type Props = {
  channel: Channel
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

export function ReconnectWhatsappModal({
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
      <Dialog
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        purpose="form"
        width={560}
      >
        <DialogHeader
          title={m.channels_whatsapp_reconnect_title()}
          onOpenChange={handleOpenChange}
        />
        {isOpen && (
          <ConnectWhatsapp
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
      </Dialog>

      <AlertDialog
        isOpen={isConfirmingClose}
        onOpenChange={setIsConfirmingClose}
        title={m.channels_whatsapp_reconnect_discard_title()}
        description={m.channels_whatsapp_reconnect_discard_description()}
        actionLabel={m.channels_connect_discard_confirm()}
        onAction={confirmDiscard}
        cancelLabel={m.channels_connect_discard_cancel()}
        actionVariant="destructive"
      />
    </>
  )
}
