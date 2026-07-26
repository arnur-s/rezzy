import { Loader } from '@/components/loader'
import {
  OnboardingForm,
  OnboardingStatusError,
  resolveOnboardingGate,
  useOnboardingStatus,
} from '@/features/onboarding'
import { useAuth } from '@/providers/auth-provider'
import { Navigate, createFileRoute } from '@tanstack/react-router'

// Deliberately outside `_authenticated`: onboarding runs before the user has a
// workspace, so it must not render the app shell.
export const Route = createFileRoute('/onboarding')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoading, session } = useAuth()
  const status = useOnboardingStatus()

  const gate = resolveOnboardingGate({
    isAuthLoading: isLoading,
    hasSession: Boolean(session),
    isStatusPending: status.isPending,
    isStatusError: status.isError,
    isOnboarded: status.isOnboarded,
  })

  if (gate === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader size="lg" />
      </div>
    )
  }

  if (gate === 'sign-in') {
    return <Navigate to="/sign-in" />
  }

  if (gate === 'error') {
    return (
      <OnboardingStatusError
        onRetry={status.refetch}
        isRetrying={status.isRetrying}
      />
    )
  }

  // Onboarding is already done, so a refresh or a stale link lands in the inbox
  // rather than creating a second workspace.
  if (gate === 'inbox' && status.primaryWorkspaceId) {
    return (
      <Navigate
        to="/workspaces/$id/inbox"
        params={{ id: status.primaryWorkspaceId }}
      />
    )
  }

  return <OnboardingForm />
}
