import { Loader } from '@/components/loader'
import { useWorkspaceReadiness } from '@/features/channels/hooks/use-channels'
import { InboxPage } from '@/features/inbox/components/inbox-page'
import { InboxReadinessError } from '@/features/inbox/components/inbox-readiness-error'
import { resolveInboxGate, useOnboardingStatus } from '@/features/onboarding'
import { useAuth } from '@/providers/auth-provider'
import {
  Navigate,
  Outlet,
  createFileRoute,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { useCallback } from 'react'

export const Route = createFileRoute('/_authenticated/workspaces/$id/inbox')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id: workspaceId } = Route.useParams()
  const allParams = useParams({ strict: false })
  const selectedConversationId = allParams.conversationId ?? null
  const navigate = useNavigate()

  const { isLoading, session } = useAuth()
  const status = useOnboardingStatus()
  const readiness = useWorkspaceReadiness(workspaceId)

  // Guarding this layout route covers the child conversation route too, so a
  // bookmarked or pasted thread URL is checked the same way navigation is.
  const gate = resolveInboxGate({
    isAuthLoading: isLoading,
    hasSession: Boolean(session),
    isStatusPending: status.isPending,
    isStatusError: status.isError,
    isOnboarded: status.isOnboarded,
    isReadinessPending: readiness.isPending,
    isReadinessError: readiness.isError,
    hasActiveChannel: readiness.hasActiveChannel,
  })

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      void navigate({
        to: '/workspaces/$id/inbox/$conversationId',
        params: { id: workspaceId, conversationId },
      })
    },
    [navigate, workspaceId],
  )

  const handleBackToList = useCallback(() => {
    void navigate({
      to: '/workspaces/$id/inbox',
      params: { id: workspaceId },
    })
  }, [navigate, workspaceId])

  if (gate === 'loading') {
    return <Loader size="lg" />
  }

  if (gate === 'sign-in') {
    return <Navigate to="/sign-in" />
  }

  if (gate === 'onboarding') {
    return <Navigate to="/onboarding" />
  }

  if (gate === 'error') {
    return (
      <InboxReadinessError
        onRetry={readiness.refetch}
        isRetrying={readiness.isRetrying}
      />
    )
  }

  // Nothing can arrive in this workspace yet, so setup is the only useful place
  // to be. The sidebar disables the entry point; this covers direct URLs.
  if (gate === 'channels') {
    return (
      <Navigate
        to="/workspaces/$id/settings/channels"
        params={{ id: workspaceId }}
        replace
      />
    )
  }

  return (
    <div className="flex flex-1 h-full min-h-0 flex-col">
      <InboxPage
        workspaceId={workspaceId}
        selectedConversationId={selectedConversationId}
        onSelectConversation={handleSelectConversation}
        onBackToList={handleBackToList}
        threadSlot={<Outlet />}
      />
    </div>
  )
}
