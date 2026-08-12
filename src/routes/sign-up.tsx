import { AuthCard } from '@/components/auth-card'
import { useLocalizedSchema } from '@/hooks/use-localized-schema'
import { m } from '@/paraglide/messages'
import { supabase } from '@/utils/supabase'
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
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

export const Route = createFileRoute('/sign-up')({
  component: RouteComponent,
})

// Built per locale rather than held as a module constant: Zod reads its
// messages when the schema is constructed, so a constant froze whichever
// language happened to be active on first import — English, for a Russian
// interface.
function createSignUpFormSchema() {
  return z.object({
    email: z.email(m.auth_sign_in_email_invalid()),
    fullName: z.string().trim().min(1, m.auth_sign_up_full_name_required()),
    password: z.string().min(8, m.auth_sign_in_password_min()),
  })
}

type SignUpFormValues = z.infer<ReturnType<typeof createSignUpFormSchema>>

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
  const schema = useLocalizedSchema(createSignUpFormSchema)

  const { control, handleSubmit } = useForm<SignUpFormValues>({
    defaultValues,
    disabled: isFormDisabled,
    resolver: standardSchemaResolver(schema),
  })

  function onSubmit(values: SignUpFormValues) {
    signUpMutation.mutate(values)
  }

  return (
    <AuthCard
      title={m.auth_sign_up_welcome()}
      description={m.auth_sign_up_description()}
    >
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
              size="lg"
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
              size="lg"
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
              size="lg"
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
          size="lg"
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
    </AuthCard>
  )
}
