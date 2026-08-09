import { SettingsSectionHeader } from '@/components/settings-section'
import { m } from '@/paraglide/messages'
import { useAccountSecurity } from '../hooks/use-account-security'
import { ChangePasswordForm } from './change-password-form'
import { SessionActions } from './session-actions'

export function SecurityPage() {
  const { canChangePassword } = useAccountSecurity()

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <SettingsSectionHeader
          title={m.security_password_title()}
          description={
            canChangePassword
              ? m.security_password_description()
              : m.security_password_unavailable()
          }
        />

        <ChangePasswordForm canChangePassword={canChangePassword} />
      </section>

      <SessionActions />
    </div>
  )
}
