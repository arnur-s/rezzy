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

export const Route = createFileRoute('/sign-in')({
  component: RouteComponent,
})

function createLoginFormSchema() {
  return z.object({
    email: z.email(m.auth_sign_in_email_invalid()),
    password: z.string().min(8, m.auth_sign_in_password_min()),
  })
}

type LoginForm = z.infer<ReturnType<typeof createLoginFormSchema>>

const defaultValues: LoginForm = {
  email: '',
  password: '',
}

function RouteComponent() {
  const navigate = useNavigate()
  const showToast = useToast()

  const loginFormSchema = useLocalizedSchema(createLoginFormSchema)

  const signInMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        showToast({
          body: m.auth_sign_in_failed_to_sign_in(),
          type: 'error',
        })
        throw error
      }

      return data
    },
    onSuccess: () => {
      navigate({ to: '/' })
    },
  })

  const isFormDisabled = signInMutation.isPending

  const { control, handleSubmit } = useForm<LoginForm>({
    resolver: standardSchemaResolver(loginFormSchema),
    defaultValues,
    disabled: isFormDisabled,
  })

  function onSubmit(data: LoginForm) {
    signInMutation.mutate(data)
  }

  return (
    <AuthCard
      title={m.auth_sign_in_welcome()}
      description={m.auth_sign_in_description()}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-6 flex flex-col gap-4"
      >
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

        <div className="flex flex-col gap-2">
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <TextInput
                label={m.common_password()}
                type="password"
                size="lg"
                placeholder="••••••••"
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

          <RouterLink
            to="/password-reset"
            className="text-accent self-end text-sm underline"
          >
            {m.auth_sign_in_forgot_password_label()}
          </RouterLink>
        </div>

        <Button
          label={m.common_sign_in()}
          type="submit"
          variant="primary"
          size="lg"
          width="100%"
          isLoading={signInMutation.isPending}
        />

        <div className="flex items-center justify-center gap-2">
          <span className="text-secondary text-sm">
            {m.auth_sign_in_dont_have_an_account_label()}
          </span>
          <RouterLink to="/sign-up" className="text-accent text-sm underline">
            {m.common_sign_up()}
          </RouterLink>
        </div>
      </form>
    </AuthCard>
  )
}
