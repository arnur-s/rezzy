import { m } from '@/paraglide/messages'
import { supabase } from '@/utils/supabase'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useMutation } from '@tanstack/react-query'
import {
  Link as RouterLink,
  createFileRoute,
  useNavigate,
} from '@tanstack/react-router'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

export const Route = createFileRoute('/sign-up')({
  component: RouteComponent,
})

const signUpFormSchema = z.object({
  email: z.email('Enter a valid email address.'),
  fullName: z.string().trim().min(1, 'Full name is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
})

type SignUpFormValues = z.infer<typeof signUpFormSchema>

const defaultValues: SignUpFormValues = {
  email: '',
  fullName: '',
  password: '',
}

type SignUpResult =
  | {
      status: 'ready'
    }
  | {
      email: string
      status: 'needs-confirmation'
    }

function RouteComponent() {
  const navigate = useNavigate()
  const showToast = useToast()

  const signUpMutation = useMutation({
    mutationFn: async (values: SignUpFormValues): Promise<SignUpResult> => {
      const fullName = values.fullName.trim()
      const email = values.email.trim().toLowerCase()

      const { data, error } = await supabase.auth.signUp({
        email,
        password: values.password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        throw error
      }

      if (!data.user) {
        throw new Error('Supabase did not return a user for this signup.')
      }

      if (!data.session) {
        return {
          email,
          status: 'needs-confirmation',
        }
      }

      return {
        status: 'ready',
      }
    },
    onError: (error) => {
      showToast({
        body:
          error instanceof Error
            ? error.message
            : m.auth_sign_up_failed_to_create_account_description(),
        type: 'error',
      })
    },
    onSuccess: (result) => {
      if (result.status === 'needs-confirmation') {
        showToast({
          body: m.auth_sign_up_needs_confirmation_description({
            email: result.email,
          }),
          type: 'info',
        })
        return
      }

      navigate({ to: '/' })
    },
  })

  const isFormDisabled = signUpMutation.isPending

  const { control, handleSubmit } = useForm<SignUpFormValues>({
    defaultValues,
    disabled: isFormDisabled,
    resolver: standardSchemaResolver(signUpFormSchema),
  })

  function onSubmit(values: SignUpFormValues) {
    signUpMutation.mutate(values)
  }

  return (
    <div className="bg-surface md:bg-body flex min-h-dvh items-center justify-center px-4">
      <Card variant="default" maxWidth={448} width="100%">
        <div className="flex flex-col gap-1">
          <Text as="p" size="lg" weight="semibold">
            {m.auth_sign_up_welcome()}
          </Text>
          <Text as="p" type="supporting">
            {m.auth_sign_up_description()}
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
                label={m.auth_sign_up_full_name_label()}
                placeholder={m.auth_sign_up_full_name_placeholder()}
                value={field.value}
                onChange={(next) => field.onChange(next)}
                isDisabled={isFormDisabled}
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
            name="email"
            render={({ field, fieldState }) => (
              <TextInput
                label={m.common_email()}
                type="email"
                placeholder={m.common_email_placeholder()}
                value={field.value}
                onChange={(next) => field.onChange(next)}
                isDisabled={isFormDisabled}
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
            name="password"
            render={({ field, fieldState }) => (
              <TextInput
                label={m.auth_sign_up_password_label()}
                type="password"
                placeholder={m.auth_sign_up_password_placeholder()}
                value={field.value}
                onChange={(next) => field.onChange(next)}
                isDisabled={isFormDisabled}
                status={
                  fieldState.error?.message
                    ? { type: 'error', message: fieldState.error.message }
                    : undefined
                }
              />
            )}
          />

          <Button
            label={m.auth_sign_up_create_account_label()}
            type="submit"
            variant="primary"
            width="100%"
            isLoading={isFormDisabled}
          />

          <div className="flex items-center justify-center gap-2">
            <span className="text-secondary text-sm">
              {m.auth_sign_up_already_have_an_account_label()}
            </span>
            <RouterLink to="/sign-in" className="text-accent text-sm underline">
              {m.common_sign_in()}
            </RouterLink>
          </div>
        </form>
      </Card>
    </div>
  )
}
