import { m } from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'
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
  const completeOnboardingMutation = useCompleteOnboarding()
  const [hasSessionExpired, setHasSessionExpired] = useState(false)

  const locale = getLocale()
  const onboardingFormSchema = useMemo(() => createOnboardingFormSchema(), [
    locale,
  ])

  const isPending = completeOnboardingMutation.isPending

  const { control, handleSubmit } = useForm<OnboardingFormValues>({
    defaultValues: { workspaceName: '' },
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
        // Not the inbox: a fresh workspace has no channel, so there is nothing
        // for it to show until one is connected.
        void navigate({
          to: '/workspaces/$id/settings/channels',
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
            name="workspaceName"
            render={({ field, fieldState }) => (
              <TextInput
                label={m.onboarding_workspace_name_label()}
                placeholder={m.onboarding_workspace_name_placeholder()}
                isRequired
                hasAutoFocus
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
            label={
              isPending ? m.onboarding_submit_pending() : m.onboarding_submit()
            }
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
