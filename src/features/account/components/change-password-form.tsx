import { useLocalizedSchema } from '@/hooks/use-localized-schema'
import { m } from '@/paraglide/messages'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { CheckIcon } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useChangePassword } from '../hooks/use-account-security'
import { createPasswordFormSchema } from '../schemas/password-form-schema'
import type { PasswordFormValues } from '../schemas/password-form-schema'

const EMPTY: PasswordFormValues = { password: '', confirmPassword: '' }

export function ChangePasswordForm({
  canChangePassword,
}: {
  canChangePassword: boolean
}) {
  const changePassword = useChangePassword()
  const [hasChanged, setHasChanged] = useState(false)

  const schema = useLocalizedSchema(createPasswordFormSchema)

  const isPending = changePassword.isPending

  const { control, handleSubmit, reset } = useForm<PasswordFormValues>({
    defaultValues: EMPTY,
    resolver: standardSchemaResolver(schema),
    disabled: isPending || !canChangePassword,
  })

  function onSubmit(values: PasswordFormValues) {
    if (isPending) return

    changePassword.mutate(values.password, {
      onSuccess: () => {
        setHasChanged(true)
        // Nothing typed here is worth keeping around once it has been sent.
        reset(EMPTY)
      },
    })
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(onSubmit)}
      onChange={() => setHasChanged(false)}
    >
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextInput
            label={m.security_password_new_label()}
            description={m.security_password_new_description()}
            type="password"
            value={field.value}
            onChange={(next) => field.onChange(next)}
            isDisabled={isPending || !canChangePassword}
            disabledMessage={
              canChangePassword ? undefined : m.security_password_unavailable()
            }
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
            value={field.value}
            onChange={(next) => field.onChange(next)}
            isDisabled={isPending || !canChangePassword}
            disabledMessage={
              canChangePassword ? undefined : m.security_password_unavailable()
            }
            status={
              fieldState.error?.message
                ? { type: 'error', message: fieldState.error.message }
                : undefined
            }
          />
        )}
      />

      {changePassword.isError ? (
        <Banner
          status="error"
          title={m.security_password_error_title()}
          description={m.security_password_error_description()}
        />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Same treatment as the profile form's Save: this is the form's one
            primary action, so on a phone it takes the full column and a 44px
            thumb target. The two live one settings tab apart and would read as
            two different button styles otherwise. */}
        <div className="[&_button]:w-full pointer-coarse:[&_button]:min-h-11 sm:[&_button]:w-auto">
          <Button
            label={
              isPending
                ? m.security_password_submit_pending()
                : m.security_password_submit()
            }
            type="submit"
            variant="primary"
            isLoading={isPending}
            isDisabled={!canChangePassword || isPending}
            tooltip={
              canChangePassword ? undefined : m.security_password_unavailable()
            }
          />
        </div>

        {hasChanged ? (
          <p
            className="text-success flex items-center gap-1.5 text-sm"
            role="status"
          >
            <CheckIcon className="size-4" aria-hidden />
            {m.security_password_success()}
          </p>
        ) : null}
      </div>
    </form>
  )
}
