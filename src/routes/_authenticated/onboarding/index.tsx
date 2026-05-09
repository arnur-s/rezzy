import { useAuth } from '@/providers/auth-provider'
import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/onboarding/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoading, session } = useAuth()

  if (isLoading) {
    return (
      <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    )
  }

  if (!session) {
    return <Navigate to="/sign-in" />
  }

  return (
    <section className="relative z-10 flex w-full justify-center"></section>
  )
}
