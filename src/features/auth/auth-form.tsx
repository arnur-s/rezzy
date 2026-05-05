import { supabase } from '#/utils/supabase'
import { m } from '@/paraglide/messages'
import {
  Alert,
  Button,
  Card,
  FieldError,
  Form,
  Input,
  Label,
  TextField,
} from '@heroui/react'
import { LogIn, UserPlus } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'

type AuthMode = 'sign-in' | 'sign-up'

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isSignUp = mode === 'sign-up'
  const passwordsDoNotMatch =
    isSignUp && confirmPassword.length > 0 && password !== confirmPassword

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setErrorMessage(null)
    setNotice(null)
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setNotice(null)

    if (isSignUp && password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        })

        if (error) {
          throw error
        }

        if (!data.session) {
          setNotice('Check your email to confirm this account.')
          return
        }

        setNotice('Account created.')
        return
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Authentication failed.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10 text-neutral-950">
      <section className="w-full max-w-md">
        <div className="mb-6 flex flex-col gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">
              {m.auth_login_welcome()}
            </h1>
          </div>
        </div>

        <Card className="w-full rounded-lg border border-neutral-200 bg-white shadow-sm">
          <Card.Header>
            <Card.Title>{isSignUp ? 'Create account' : 'Sign in'}</Card.Title>
            <Card.Description>
              {isSignUp
                ? 'Use an email and password for this workspace.'
                : 'Use your workspace email and password.'}
            </Card.Description>
          </Card.Header>

          <Card.Content className="gap-5">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-neutral-100 p-1">
              <Button
                fullWidth
                type="button"
                variant={mode === 'sign-in' ? 'primary' : 'ghost'}
                onPress={() => switchMode('sign-in')}
              >
                <LogIn aria-hidden="true" className="size-4" />
                Sign in
              </Button>
              <Button
                fullWidth
                type="button"
                variant={mode === 'sign-up' ? 'primary' : 'ghost'}
                onPress={() => switchMode('sign-up')}
              >
                <UserPlus aria-hidden="true" className="size-4" />
                Sign up
              </Button>
            </div>

            {errorMessage ? (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{errorMessage}</Alert.Title>
                </Alert.Content>
              </Alert>
            ) : null}

            {notice ? (
              <Alert status="success">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{notice}</Alert.Title>
                </Alert.Content>
              </Alert>
            ) : null}

            <Form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <TextField
                isRequired
                fullWidth
                name="email"
                type="email"
                value={email}
                onChange={setEmail}
              >
                <Label>Email</Label>
                <Input
                  autoComplete="email"
                  placeholder="name@example.com"
                  variant="secondary"
                />
                <FieldError />
              </TextField>

              <TextField
                isRequired
                fullWidth
                name="password"
                type="password"
                value={password}
                onChange={setPassword}
              >
                <Label>Password</Label>
                <Input
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={6}
                  placeholder="Enter password"
                  variant="secondary"
                />
                <FieldError />
              </TextField>

              {isSignUp ? (
                <TextField
                  isRequired
                  fullWidth
                  isInvalid={passwordsDoNotMatch}
                  name="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                >
                  <Label>Confirm password</Label>
                  <Input
                    autoComplete="new-password"
                    minLength={6}
                    placeholder="Re-enter password"
                    variant="secondary"
                  />
                  <FieldError>
                    {passwordsDoNotMatch ? 'Passwords do not match.' : null}
                  </FieldError>
                </TextField>
              ) : null}

              <Button
                fullWidth
                isPending={isSubmitting}
                type="submit"
                variant="primary"
              >
                {isSignUp ? 'Create account' : 'Sign in'}
              </Button>
            </Form>
          </Card.Content>
        </Card>
      </section>
    </main>
  )
}
