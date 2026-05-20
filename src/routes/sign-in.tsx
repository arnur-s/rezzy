import { Button } from '@/components/button'
import { m } from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'
import { supabase } from '@/utils/supabase'
import {
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
import {
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  MessageCircleIcon,
} from 'lucide-react'
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
    <div className="flex min-h-dvh flex-col bg-surface lg:flex-row">
      {/* Brand panel — top strip on mobile, left column on desktop */}
      <div className="flex flex-col items-center justify-center bg-accent px-8 py-12 text-accent-foreground lg:w-2/5">
        <div className="mb-4 rounded-2xl bg-white/20 p-4">
          <MessageCircleIcon className="size-8" />
        </div>
        <span className="text-2xl font-bold">{m.sidebar_brand_label()}</span>
        <p className="mt-2 hidden max-w-xs text-center text-sm text-accent-foreground/75 lg:block">
          {m.auth_sign_in_brand_tagline()}
        </p>
      </div>

      {/* Form panel — bottom sheet on mobile, right column on desktop */}
      <div className="-mt-6 flex flex-1 items-start justify-center rounded-t-3xl bg-surface px-6 py-10 lg:mt-0 lg:items-center lg:rounded-none lg:px-8">
        <div className="w-full max-w-md">
          <h1 className="text-xl font-semibold text-foreground">
            {m.auth_sign_in_welcome()}
          </h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            {m.auth_sign_in_description()}
          </p>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
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

            <Button
              type="submit"
              fullWidth
              isLoading={signInMutation.isPending}
            >
              {m.common_sign_in()}
            </Button>

            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">
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
          </form>
        </div>
      </div>
    </div>
  )
}
