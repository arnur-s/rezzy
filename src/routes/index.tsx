import { useAuth } from '@/providers/auth-provider'
import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoading, session } = useAuth()

  if (isLoading) {
    return null
  }

  if (!session) {
    return <Navigate to="/sign-in" />
  }

  return <Navigate to="/dashboard" />
}
