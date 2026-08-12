import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Button } from '@astryxdesign/core/Button'
import { useToast } from '@astryxdesign/core/Toast'
import { useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useSignOutOtherSessions } from '../hooks/use-account-security'

type Confirmation = 'this-device' | 'other-devices' | null

function errorBody(error: unknown) {
  return error instanceof Error ? error.message : m.common_unknown_error()
}

/**
 * Ending sessions is not a preference, so it sits behind a confirmation and
 * apart from the settings above it.
 */
export function SessionActions() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { signOut } = useAuth()
  const signOutOthers = useSignOutOtherSessions()

  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  // Focus goes back to whichever button opened the dialog once it closes.
  const thisDeviceRef = useRef<HTMLButtonElement>(null)
  const otherDevicesRef = useRef<HTMLButtonElement>(null)

  function close(returnFocusTo: 'this-device' | 'other-devices') {
    setConfirmation(null)
    const target =
      returnFocusTo === 'this-device' ? thisDeviceRef : otherDevicesRef
    target.current?.focus()
  }

  async function handleSignOutThisDevice() {
    try {
      setIsSigningOut(true)
      await signOut('local')
      await navigate({ to: '/sign-in' })
    } catch (error) {
      setIsSigningOut(false)
      close('this-device')
      showToast({ body: errorBody(error), type: 'error' })
    }
  }

  function handleSignOutOtherDevices() {
    signOutOthers.mutate(undefined, {
      onSuccess: () => {
        close('other-devices')
        showToast({ body: m.security_sign_out_others_success(), type: 'info' })
      },
      onError: (error) => {
        close('other-devices')
        showToast({ body: errorBody(error), type: 'error' })
      },
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-primary text-base font-semibold">
          {m.security_sessions_title()}
        </h2>
      </div>

      <div className="border-border/60 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        {/* A row action rather than a form submit, so it keeps hugging its
            label — only the thumb target grows. Ending sessions is not
            something to make easier to hit by accident than it needs to be. */}
        <div className="flex items-center justify-between">
          <Button
            ref={otherDevicesRef}
            label={m.security_sign_out_others_action()}
            variant="secondary"
            isLoading={signOutOthers.isPending}
            isDisabled={signOutOthers.isPending || isSigningOut}
            onClick={() => setConfirmation('other-devices')}
          />

          <Button
            ref={thisDeviceRef}
            label={m.security_sign_out_action()}
            variant="destructive"
            isLoading={isSigningOut}
            isDisabled={isSigningOut || signOutOthers.isPending}
            onClick={() => setConfirmation('this-device')}
          />
        </div>
      </div>

      <AlertDialog
        isOpen={confirmation === 'other-devices'}
        onOpenChange={(isOpen) => {
          if (!isOpen) close('other-devices')
        }}
        title={m.security_sign_out_others_confirm_title()}
        description={m.security_sign_out_others_confirm_description()}
        actionLabel={m.security_sign_out_others_action()}
        actionVariant="secondary"
        isActionLoading={signOutOthers.isPending}
        cancelLabel={m.common_cancel()}
        onAction={handleSignOutOtherDevices}
      />

      <AlertDialog
        isOpen={confirmation === 'this-device'}
        onOpenChange={(isOpen) => {
          if (!isOpen) close('this-device')
        }}
        title={m.security_sign_out_confirm_title()}
        description={m.security_sign_out_confirm_description()}
        actionLabel={m.security_sign_out_action()}
        isActionLoading={isSigningOut}
        cancelLabel={m.common_cancel()}
        onAction={() => void handleSignOutThisDevice()}
      />
    </section>
  )
}
