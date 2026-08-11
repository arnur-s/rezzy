import { m } from '@/paraglide/messages'
import { useState } from 'react'
import type { WhatsappConnectionTarget } from '../types/whatsapp-connection-target'
import { ConnectWhatsappForm } from './connect-whatsapp-form'
import { ConnectWhatsappManualForm } from './connect-whatsapp-manual-form'

type Props = {
  target: WhatsappConnectionTarget
  onCancel: () => void
  onSuccess?: () => void
  onDirtyChange?: (isDirty: boolean) => void
}

/**
 * WhatsApp connect step. Embedded Signup is the default; the manual path exists
 * for workspaces whose Meta app cannot onboard through Embedded Signup (it
 * requires Tech Provider status and business verification) and takes Cloud API
 * credentials directly instead.
 */
export function ConnectWhatsapp({
  target,
  onCancel,
  onSuccess,
  onDirtyChange,
}: Props) {
  const [isManual, setIsManual] = useState(false)

  if (isManual) {
    return (
      <ConnectWhatsappManualForm
        target={target}
        onBack={() => setIsManual(false)}
        onDirtyChange={onDirtyChange}
        onSuccess={onSuccess}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ConnectWhatsappForm
        target={target}
        onCancel={onCancel}
        onDirtyChange={onDirtyChange}
        onSuccess={onSuccess}
      />

      <div className="border-t border-border/15 pt-4">
        <button
          className="text-sm text-secondary underline underline-offset-4 transition hover:text-primary"
          type="button"
          onClick={() => setIsManual(true)}
        >
          {target.kind === 'reconnect'
            ? m.channels_whatsapp_reconnect_manual_link()
            : m.channels_whatsapp_manual_link()}
        </button>
      </div>
    </div>
  )
}
