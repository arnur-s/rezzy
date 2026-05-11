import {
  Card,
  FieldError,
  InputGroup,
  Label,
  TextField,
  toast,
} from '@heroui/react'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useMutation } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { supabase } from '@/utils/supabase'
import { getLocale } from '@/paraglide/runtime'
import { m } from '@/paraglide/messages'
import { SidebarInset } from '@/components/sidebar'
import { AppButton } from '@/components/app-button'

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
  const [showPassword, setShowPassword] = useState(false)

  const locale = getLocale()
  const loginFormSchema = useMemo(() => createLoginFormSchema(), [locale])

  const signInMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        toast.danger(m.auth_sign_in_failed_to_sign_in())
        throw error
      }

      return data
    },
    onSuccess: () => {
      navigate({ to: '/' })
    },
  })

  const isFormDisabled = signInMutation.isPending

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: standardSchemaResolver(loginFormSchema),
    defaultValues,
    disabled: isFormDisabled,
  })

  function onSubmit(data: LoginForm) {
    signInMutation.mutate(data)
  }

  return (
    <SidebarInset className="min-h-dvh flex items-center justify-center">
      <Card className="w-full max-w-md border border-border bg-card text-card-foreground shadow-surface z-1">
        <Card.Header>
          <Card.Title>{m.auth_sign_in_welcome()}</Card.Title>
          <Card.Description>{m.auth_sign_in_description()}</Card.Description>
        </Card.Header>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card.Content>
            <TextField isInvalid={!!errors.email} isDisabled={isFormDisabled}>
              <Label>{m.common_email()}</Label>
              <InputGroup variant="secondary">
                <InputGroup.Prefix>
                  <MailIcon className="size-4" />
                </InputGroup.Prefix>
                <InputGroup.Input
                  placeholder={m.common_email_placeholder()}
                  {...register('email')}
                />
              </InputGroup>
              <FieldError>{errors.email?.message}</FieldError>
            </TextField>

            <TextField
              isInvalid={!!errors.password}
              isDisabled={isFormDisabled}
            >
              <Label>{m.common_password()}</Label>
              <InputGroup variant="secondary">
                <InputGroup.Prefix>
                  <LockIcon className="size-4" />
                </InputGroup.Prefix>
                <InputGroup.Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password')}
                />
                <InputGroup.Suffix
                  role="button"
                  className="cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeIcon className="size-4" />
                  ) : (
                    <EyeOffIcon className="size-4" />
                  )}
                </InputGroup.Suffix>
              </InputGroup>
              <FieldError>{errors.password?.message}</FieldError>
            </TextField>

            <div className="text-right">
              <Link to="/password-reset" className="link">
                {m.auth_sign_in_forgot_password_label()}
              </Link>
            </div>
          </Card.Content>

          <Card.Footer className="mt-4 flex-col gap-4">
            <AppButton
              type="submit"
              fullWidth
              isLoading={signInMutation.isPending}
            >
              {m.common_sign_in()}
            </AppButton>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {m.auth_sign_in_dont_have_an_account_label()}
              </span>

              <Link to="/sign-up" className="link">
                {m.common_sign_up()}
              </Link>
            </div>
          </Card.Footer>
        </form>
      </Card>
    </SidebarInset>
  )
}
