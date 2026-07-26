import { m } from '@/paraglide/messages'
import { Badge } from '@astryxdesign/core/Badge'
import { useAccountSecurity } from '../hooks/use-account-security'
import { ChangePasswordForm } from './change-password-form'
import { SessionActions } from './session-actions'

/** Partial on purpose: an unrecognized provider is shown under its own name. */
const PROVIDER_LABELS: Partial<Record<string, () => string>> = {
  email: () => m.security_provider_email(),
}

function providerLabel(provider: string) {
  return PROVIDER_LABELS[provider]?.() ?? provider
}

export function SecurityPage() {
  const { email, providers, canChangePassword } = useAccountSecurity()

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-primary text-base font-semibold">
            {m.security_account_title()}
          </h2>
          <p className="text-secondary mt-1 text-sm">
            {m.security_account_description()}
          </p>
        </div>

        <dl className="divide-border/60 border-border/60 divide-y border-y text-sm">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-secondary">{m.common_email()}</dt>
            <dd className="text-primary truncate font-medium">{email}</dd>
          </div>

          {/* Read-only: what this account can sign in with today. There is no
              linking or unlinking behind it. */}
          {providers.length > 0 ? (
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-secondary">
                {m.security_providers_label()}
              </dt>
              <dd className="flex flex-wrap justify-end gap-1.5">
                {providers.map((provider) => (
                  <Badge
                    key={provider}
                    variant="neutral"
                    label={providerLabel(provider)}
                  />
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

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
