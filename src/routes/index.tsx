import { useAuth } from '#/providers/auth-provider'
import { supabase } from '#/utils/supabase'
import { Alert, Button, Card, Spinner } from '@heroui/react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

type Todo = { id: string; name: string }

export const Route = createFileRoute('/')({
  component: Home,
  beforeLoad: async ({ context }) => {
    if (!context.auth?.session) {
      throw redirect({
        to: '/login',
      })
    }
  },
})

function Home() {
  const { isLoading, session, signOut, user } = useAuth()
  const [isFetchingTodos, setIsFetchingTodos] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])

  useEffect(() => {
    if (!session) {
      setTodos([])
      setErrorMessage(null)
      setIsFetchingTodos(false)
      return
    }

    let isMounted = true

    async function getTodos() {
      setIsFetchingTodos(true)
      setErrorMessage(null)

      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false })

      if (!isMounted) {
        return
      }

      if (error) {
        setErrorMessage(error.message)
        setTodos([])
        setIsFetchingTodos(false)
        return
      }

      setTodos(data)
      setIsFetchingTodos(false)
    }

    getTodos()

    return () => {
      isMounted = false
    }
  }, [session])

  async function handleSignOut() {
    setErrorMessage(null)

    try {
      await signOut()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to sign out.',
      )
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-950">
        <div className="flex items-center gap-3 text-sm font-medium text-neutral-700">
          <Spinner size="sm" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-medium text-emerald-800">CMS</p>
            <h1 className="text-2xl font-semibold tracking-normal"></h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="max-w-full truncate text-sm text-neutral-600">
              {user?.email}
            </span>
            <Button variant="secondary" onPress={handleSignOut}>
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
        {errorMessage ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Supabase request failed</Alert.Title>
              <Alert.Description>{errorMessage}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        <Card className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <Card.Header>
            <Card.Title>Todos</Card.Title>
            <Card.Description>
              Authenticated Supabase data for this workspace.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {isFetchingTodos ? (
              <div className="flex items-center gap-3 py-8 text-sm text-neutral-600">
                <Spinner size="sm" />
                Loading todos
              </div>
            ) : todos.length > 0 ? (
              <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
                {todos.map((todo) => (
                  <li
                    className="flex min-h-12 items-center px-4 text-sm"
                    key={todo.id}
                  >
                    {todo.name}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-neutral-300 px-4 py-8 text-sm text-neutral-600">
                No todos found.
              </div>
            )}
          </Card.Content>
        </Card>
      </div>
    </main>
  )
}
