import { Button } from '@/components/button'
import { m } from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'
import { supabase } from '@/utils/supabase'
import {
  Card,
  FieldError,
  Link as HeroLink,
  InputGroup,
  Label,
  TextField,
  toast,
} from '@heroui/react'
import { cn } from '@heroui/styles'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useMutation } from '@tanstack/react-query'
import {
  Link as RouterLink,
  createFileRoute,
  useNavigate,
} from '@tanstack/react-router'
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
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
    <div className="min-h-dvh flex items-center justify-center bg-surface md:bg-background">
      <Card
        className={cn(
          'z-1 flex w-full max-w-md flex-col gap-6 md:px-6 md:py-8',
          'max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:rounded-none',
          'md:border md:border-border md:text-surface-foreground md:shadow-surface',
        )}
      >
        <Card.Header>
          <Card.Title>{m.auth_sign_in_welcome()}</Card.Title>
          <Card.Description>{m.auth_sign_in_description()}</Card.Description>
        </Card.Header>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
          <Card.Content className="gap-4">
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
              <HeroLink
                href="/password-reset"
                render={({ className, children }) => (
                  <RouterLink to="/password-reset" className={cn(className)}>
                    {children}
                  </RouterLink>
                )}
              >
                {m.auth_sign_in_forgot_password_label()}
              </HeroLink>
            </div>
          </Card.Content>

          <Card.Footer className="mt-4 flex-col gap-4">
            <Button
              type="submit"
              fullWidth
              isLoading={signInMutation.isPending}
            >
              {m.common_sign_in()}
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">
                {m.auth_sign_in_dont_have_an_account_label()}
              </span>

              <HeroLink
                href="/sign-up"
                render={({ className, children }) => (
                  <RouterLink to="/sign-up" className={cn(className)}>
                    {children}
                  </RouterLink>
                )}
              >
                {m.common_sign_up()}
              </HeroLink>
            </div>
          </Card.Footer>
        </form>
      </Card>
    </div>
  )
}
