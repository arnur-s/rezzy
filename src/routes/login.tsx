import { m } from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'
import {
  Button,
  Card,
  FieldError,
  InputGroup,
  Label,
  Link,
  TextField,
} from '@heroui/react'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { createFileRoute } from '@tanstack/react-router'
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

export const Route = createFileRoute('/login')({
  component: RouteComponent,
})

function createLoginFormSchema() {
  return z.object({
    email: z.email(m.auth_login_email_invalid()),
    password: z.string().min(8, m.auth_login_password_min()),
  })
}

type LoginForm = z.infer<ReturnType<typeof createLoginFormSchema>>

const defaultValues: LoginForm = {
  email: '',
  password: '',
}

function RouteComponent() {
  const loginFormSchema = useMemo(() => createLoginFormSchema(), [getLocale()])
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: standardSchemaResolver(loginFormSchema),
    defaultValues,
  })

  function onSubmit(data: LoginForm) {
    console.log(data)
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <Card.Header>
          <Card.Title>{m.auth_login_welcome()}</Card.Title>
          <Card.Description>{m.auth_login_description()}</Card.Description>
        </Card.Header>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card.Content>
            <TextField isInvalid={!!errors.email}>
              <Label>{m.auth_login_email_label()}</Label>
              <InputGroup variant="secondary">
                <InputGroup.Prefix>
                  <MailIcon className="size-4" />
                </InputGroup.Prefix>
                <InputGroup.Input
                  placeholder="john@example.com"
                  {...register('email')}
                />
              </InputGroup>
              <FieldError>{errors.email?.message}</FieldError>
            </TextField>

            <TextField isInvalid={!!errors.password}>
              <Label>{m.auth_login_password_label()}</Label>
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

          <Card.Footer className="mt-4 flex flex-col gap-2">
            <Button type="submit" fullWidth>
              {m.auth_login_button_label()}
            </Button>
            <Link className="text-center text-sm" href="#">
              {m.auth_login_forgot_password_label()}
            </Link>
          </Card.Footer>
        </form>
      </Card>
    </div>
  )
}
