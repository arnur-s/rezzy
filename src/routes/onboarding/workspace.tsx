import { WorkspaceSetupForm } from '@/features/workspaces/workspace-setup-form'
import { useAuth } from '@/providers/auth-provider'
import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/onboarding/workspace')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoading, session } = useAuth()

  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </main>
    )
  }

  if (!session) {
    return <Navigate to="/sign-in" />
  }

  return (
    <main className="auth-ambient flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <section className="relative z-10 flex w-full justify-center">
        <WorkspaceSetupForm />
      </section>
    </main>
  )
}
