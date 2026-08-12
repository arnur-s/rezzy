import { AuthCard } from '@/components/auth-card'
import { useLocalizedSchema } from '@/hooks/use-localized-schema'
import { isPasswordRecoveryLink } from '@/lib/password-recovery'
import { m } from '@/paraglide/messages'
import { supabase } from '@/utils/supabase'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useMutation } from '@tanstack/react-query'
import {
  Link as RouterLink,
  createFileRoute,
  useNavigate,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { createPasswordFormSchema } from '@/features/account/schemas/password-form-schema'
import type { PasswordFormValues } from '@/features/account/schemas/password-form-schema'

export const Route = createFileRoute('/password-reset')({
  component: RouteComponent,
})

function createRequestSchema() {
  return z.object({ email: z.email(m.auth_sign_in_email_invalid()) })
}

type RequestFormValues = z.infer<ReturnType<typeof createRequestSchema>>

/**
 * Two states behind one URL, because that is what Supabase's recovery flow
 * hands us: arriving cold, this is the "email me a link" form; arriving from
 * the emailed link, Supabase has already exchanged the token for a session and
 * fired `PASSWORD_RECOVERY`, so the same route becomes "set a new password".
 *
 * Splitting them across two routes would mean the recovery link had to carry
 * the distinction in its redirect URL, and any user who reloaded the page would
 * land on a form that no longer applied to their session.
 */
function RouteComponent() {
  // Seeded from the URL rather than only from the event. Supabase consumes the
  // recovery fragment during boot and emits `PASSWORD_RECOVERY` from a
  // `setTimeout(…, 0)`; this route is code-split, so it subscribes strictly
  // after that fires and would otherwise never see it — leaving someone who
  // just clicked the emailed link staring at the "email me a link" form.
  const [isRecovering, setIsRecovering] = useState(isPasswordRecoveryLink)

  useEffect(() => {
    // Still subscribed: the URL snapshot covers the cold load, and this covers
    // a recovery that resolves after mount (e.g. the PKCE code exchange, which
    // reports the recovery type only through the event).
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovering(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return isRecovering ? <SetNewPassword /> : <RequestResetLink />
}

function RequestResetLink() {
  const schema = useLocalizedSchema(createRequestSchema)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const requestReset = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/password-reset`,
      })
      if (error) throw error
      return email
    },
    onSuccess: (email) => setSentTo(email),
  })

  const { control, handleSubmit } = useForm<RequestFormValues>({
    defaultValues: { email: '' },
    disabled: requestReset.isPending,
    resolver: standardSchemaResolver(schema),
  })

  if (sentTo) {
    return (
      <AuthCard
        title={m.password_reset_sent_title()}
        description={m.password_reset_sent_description({ email: sentTo })}
      >
        <div className="mt-6 flex flex-col gap-3">
          <Button
            label={m.password_reset_sent_resend()}
            variant="secondary"
            size="lg"
            width="100%"
            isLoading={requestReset.isPending}
            onClick={() => requestReset.mutate(sentTo)}
          />
          <RouterLink
            to="/sign-in"
            className="text-accent text-center text-sm underline"
          >
            {m.password_reset_back_to_sign_in()}
          </RouterLink>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title={m.password_reset_request_title()}
      description={m.password_reset_request_description()}
    >
      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={handleSubmit((values) => requestReset.mutate(values.email))}
      >
        {requestReset.isError ? (
          <Banner status="error" title={m.password_reset_request_error()} />
        ) : null}

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextInput
              label={m.common_email()}
              type="email"
              size="lg"
              placeholder={m.common_email_placeholder()}
              hasAutoFocus
              value={field.value}
              onChange={(next) => field.onChange(next)}
              isDisabled={requestReset.isPending}
              status={
                fieldState.error?.message
                  ? { type: 'error', message: fieldState.error.message }
                  : undefined
              }
            />
          )}
        />

        <Button
          label={
            requestReset.isPending
              ? m.password_reset_request_pending()
              : m.password_reset_request_submit()
          }
          type="submit"
          variant="primary"
          size="lg"
          width="100%"
          isLoading={requestReset.isPending}
        />

        <RouterLink
          to="/sign-in"
          className="text-accent text-center text-sm underline"
        >
          {m.password_reset_back_to_sign_in()}
        </RouterLink>
      </form>
    </AuthCard>
  )
}

function SetNewPassword() {
  const navigate = useNavigate()
  const showToast = useToast()
  const schema = useLocalizedSchema(createPasswordFormSchema)

  const updatePassword = useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
    onSuccess: () => {
      showToast({ body: m.password_reset_update_success(), type: 'info' })
      void navigate({ to: '/' })
    },
  })

  const { control, handleSubmit } = useForm<PasswordFormValues>({
    defaultValues: { password: '', confirmPassword: '' },
    disabled: updatePassword.isPending,
    resolver: standardSchemaResolver(schema),
  })

  return (
    <AuthCard
      title={m.password_reset_update_title()}
      description={m.password_reset_update_description()}
    >
      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={handleSubmit((values) =>
          updatePassword.mutate(values.password),
        )}
      >
        {updatePassword.isError ? (
          <Banner
            status="error"
            title={m.security_password_error_title()}
            description={m.security_password_error_description()}
          />
        ) : null}

        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <TextInput
              label={m.security_password_new_label()}
              description={m.security_password_new_description()}
              type="password"
              size="lg"
              hasAutoFocus
              value={field.value}
              onChange={(next) => field.onChange(next)}
              isDisabled={updatePassword.isPending}
              status={
                fieldState.error?.message
                  ? { type: 'error', message: fieldState.error.message }
                  : undefined
              }
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <TextInput
              label={m.security_password_confirm_label()}
              type="password"
              size="lg"
              value={field.value}
              onChange={(next) => field.onChange(next)}
              isDisabled={updatePassword.isPending}
              status={
                fieldState.error?.message
                  ? { type: 'error', message: fieldState.error.message }
                  : undefined
              }
            />
          )}
        />

        <Button
          label={
            updatePassword.isPending
              ? m.security_password_submit_pending()
              : m.password_reset_update_submit()
          }
          type="submit"
          variant="primary"
          size="lg"
          width="100%"
          isLoading={updatePassword.isPending}
        />
      </form>
    </AuthCard>
  )
}
