import { getUserMetadataFullName } from '@/entities/user'
import { m } from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'
import { useAuth } from '@/providers/auth-provider'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { OnboardingSessionExpiredError } from '../api/onboarding'
import { useCompleteOnboarding } from '../hooks/use-complete-onboarding'
import type { OnboardingFormValues } from '../schemas/onboarding-form-schema'
import { createOnboardingFormSchema } from '../schemas/onboarding-form-schema'

export function OnboardingForm() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const completeOnboardingMutation = useCompleteOnboarding()
  const [hasSessionExpired, setHasSessionExpired] = useState(false)

  const locale = getLocale()
  const onboardingFormSchema = useMemo(() => createOnboardingFormSchema(), [
    locale,
  ])

  // Sign-up already collected a name; when it is present the workspace name is
  // the first field worth typing in.
  const signUpFullName = useMemo(() => getUserMetadataFullName(user), [user])

  const isPending = completeOnboardingMutation.isPending

  const { control, handleSubmit } = useForm<OnboardingFormValues>({
    defaultValues: { fullName: signUpFullName, workspaceName: '' },
    disabled: isPending,
    resolver: standardSchemaResolver(onboardingFormSchema),
  })

  function onSubmit(values: OnboardingFormValues) {
    // Belt and braces with the disabled button: a queued Enter keypress must
    // not start a second setup while the first is in flight.
    if (isPending) {
      return
    }

    completeOnboardingMutation.mutate(values, {
      onError: (error) => {
        setHasSessionExpired(error instanceof OnboardingSessionExpiredError)
      },
      onSuccess: (result) => {
        setHasSessionExpired(false)
        void navigate({
          to: '/workspaces/$id/inbox',
          params: { id: result.workspaceId },
        })
      },
    })
  }

  return (
    <div className="bg-surface md:bg-body flex min-h-dvh items-center justify-center px-4">
      <Card variant="default" maxWidth={448} width="100%">
        <div className="flex flex-col gap-1">
          <Text as="h1" size="lg" weight="semibold">
            {m.onboarding_title()}
          </Text>
          <Text as="p" type="supporting">
            {m.onboarding_description()}
          </Text>
        </div>

        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={handleSubmit(onSubmit)}
        >
          <Controller
            control={control}
            name="fullName"
            render={({ field, fieldState }) => (
              <TextInput
                label={m.onboarding_full_name_label()}
                placeholder={m.onboarding_full_name_placeholder()}
                isRequired
                hasAutoFocus={!signUpFullName}
                value={field.value}
                onChange={(next) => field.onChange(next)}
                isDisabled={isPending}
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
            name="workspaceName"
            render={({ field, fieldState }) => (
              <TextInput
                label={m.onboarding_workspace_name_label()}
                placeholder={m.onboarding_workspace_name_placeholder()}
                isRequired
                hasAutoFocus={Boolean(signUpFullName)}
                value={field.value}
                onChange={(next) => field.onChange(next)}
                isDisabled={isPending}
                status={
                  fieldState.error?.message
                    ? { type: 'error', message: fieldState.error.message }
                    : undefined
                }
              />
            )}
          />

          {/* The setup is transactional, so a failure leaves nothing behind and
              submitting again is a safe retry. Typed values are never reset. */}
          {completeOnboardingMutation.isError && (
            <Banner
              status="error"
              title={m.onboarding_error_title()}
              description={
                hasSessionExpired
                  ? m.onboarding_error_session_expired()
                  : m.onboarding_error_description()
              }
              endContent={
                hasSessionExpired ? (
                  <Button
                    label={m.common_sign_in()}
                    size="sm"
                    variant="secondary"
                    onClick={() => void navigate({ to: '/sign-in' })}
                  />
                ) : undefined
              }
            />
          )}

          <Button
            label={m.onboarding_submit()}
            type="submit"
            variant="primary"
            width="100%"
            isLoading={isPending}
          />
        </form>
      </Card>
    </div>
  )
}
