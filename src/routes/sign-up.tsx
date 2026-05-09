import { AppButton } from '@/components/app-button'
import { SidebarInset } from '@/components/sidebar'
import { m } from '@/paraglide/messages'
import { supabase } from '@/utils/supabase'
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
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  UserRoundIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
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
  const [showPassword, setShowPassword] = useState(false)

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
      toast.danger(m.auth_sign_up_failed_to_create_account(), {
        description:
          error instanceof Error
            ? error.message
            : m.auth_sign_up_failed_to_create_account_description(),
      })
    },
    onSuccess: (result) => {
      if (result.status === 'needs-confirmation') {
        toast.info(m.auth_sign_up_needs_confirmation(), {
          description: m.auth_sign_up_needs_confirmation_description({
            email: result.email,
          }),
        })
        return
      }

      navigate({ to: '/workspaces' })
    },
  })

  const isFormDisabled = signUpMutation.isPending

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    defaultValues,
    disabled: isFormDisabled,
    resolver: standardSchemaResolver(signUpFormSchema),
  })

  function onSubmit(values: SignUpFormValues) {
    signUpMutation.mutate(values)
  }

  return (
    <SidebarInset className="min-h-dvh flex items-center justify-center">
      <Card className="w-full max-w-md border border-border bg-card text-card-foreground shadow-surface z-1">
        <Card.Header>
          <Card.Title>{m.auth_sign_up_welcome()}</Card.Title>
          <Card.Description>{m.auth_sign_up_description()}</Card.Description>
        </Card.Header>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <Card.Content className="gap-4">
            <TextField
              fullWidth
              isDisabled={isFormDisabled}
              isInvalid={!!errors.fullName}
            >
              <Label>{m.auth_sign_up_full_name_label()}</Label>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.Prefix>
                  <UserRoundIcon className="size-4" />
                </InputGroup.Prefix>
                <InputGroup.Input
                  autoComplete="name"
                  placeholder={m.auth_sign_up_full_name_placeholder()}
                  {...register('fullName')}
                />
              </InputGroup>
              <FieldError>{errors.fullName?.message}</FieldError>
            </TextField>

            <TextField
              fullWidth
              isDisabled={isFormDisabled}
              isInvalid={!!errors.email}
            >
              <Label>{m.common_email()}</Label>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.Prefix>
                  <MailIcon className="size-4" />
                </InputGroup.Prefix>
                <InputGroup.Input
                  autoComplete="email"
                  placeholder={m.common_email_placeholder()}
                  type="email"
                  {...register('email')}
                />
              </InputGroup>
              <FieldError>{errors.email?.message}</FieldError>
            </TextField>

            <TextField
              fullWidth
              isDisabled={isFormDisabled}
              isInvalid={!!errors.password}
            >
              <Label>{m.auth_sign_up_password_label()}</Label>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.Prefix>
                  <LockIcon className="size-4" />
                </InputGroup.Prefix>
                <InputGroup.Input
                  autoComplete="new-password"
                  placeholder={m.auth_sign_up_password_placeholder()}
                  type={showPassword ? 'text' : 'password'}
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
          </Card.Content>

          <Card.Footer className="mt-4 flex-col gap-4">
            <AppButton fullWidth isLoading={isFormDisabled} type="submit">
              {m.auth_sign_up_create_account_label()}
            </AppButton>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {m.auth_sign_up_already_have_an_account_label()}
              </span>
              <Link to="/sign-in" className="link">
                {m.common_sign_in()}
              </Link>
            </div>
          </Card.Footer>
        </form>
      </Card>
    </SidebarInset>
  )
}
