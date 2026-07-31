import { m } from '@/paraglide/messages'
import { useAccountSecurity } from '../hooks/use-account-security'
import { ChangePasswordForm } from './change-password-form'
import { SessionActions } from './session-actions'

export function SecurityPage() {
  const { canChangePassword } = useAccountSecurity()

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-primary text-base font-semibold">
            {m.security_password_title()}
          </h2>
          <p className="text-secondary mt-1 text-sm">
            {canChangePassword
              ? m.security_password_description()
              : m.security_password_unavailable()}
          </p>
        </div>

        <ChangePasswordForm canChangePassword={canChangePassword} />
      </section>

      <SessionActions />
    </div>
  )
}
