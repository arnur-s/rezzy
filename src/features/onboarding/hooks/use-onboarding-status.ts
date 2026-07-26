import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { useAuth } from '@/providers/auth-provider'

export type OnboardingStatus = {
  isError: boolean
  isOnboarded: boolean
  isPending: boolean
  isRetrying: boolean
  /** Workspace to land in once onboarding is complete; null while unknown. */
  primaryWorkspaceId: string | null
  refetch: () => void
}

/**
 * Onboarding is complete when the user has at least one visible workspace.
 *
 * The workspaces select policy already requires a live workspace and a
 * membership, so the list doubles as the onboarding record — no status column
 * to keep in sync. This reuses the existing `workspaces/list` query, so gating a
 * route on it costs no extra request.
 */
export function useOnboardingStatus(): OnboardingStatus {
  const { user } = useAuth()
  const workspacesQuery = useWorkspaces(user?.id)

  const workspaces = workspacesQuery.data ?? []

  return {
    isError: workspacesQuery.isError,
    isOnboarded: workspaces.length > 0,
    // `useWorkspaces` stays disabled until the user id resolves, and a disabled
    // query reports `isPending` without ever loading. Treat a missing user as
    // pending too so the gate waits instead of redirecting to onboarding.
    isPending: !user?.id || workspacesQuery.isPending,
    isRetrying: workspacesQuery.isRefetching,
    // Matches getUserWorkspaces' ordering: main workspace first, then oldest.
    primaryWorkspaceId: workspaces.at(0)?.id ?? null,
    refetch: () => {
      void workspacesQuery.refetch()
    },
  }
}
