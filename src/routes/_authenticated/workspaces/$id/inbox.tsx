import { AppPane } from '@/components/app-pane'
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
    return (
      <AppPane>
        <Loader size="lg" />
      </AppPane>
    )
  }

  if (gate === 'sign-in') {
    return <Navigate to="/sign-in" />
  }

  if (gate === 'onboarding') {
    return <Navigate to="/onboarding" />
  }

  if (gate === 'error') {
    return (
      <AppPane>
        <InboxReadinessError
          onRetry={readiness.refetch}
          isRetrying={readiness.isRetrying}
        />
      </AppPane>
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

  // No wrapper: `InboxPage` returns the panes themselves, and they have to be
  // direct children of the shell's pane group for the gutter to fall between
  // them. A column wrapper here would collapse all three into one row cell.
  return (
    <InboxPage
      workspaceId={workspaceId}
      selectedConversationId={selectedConversationId}
      onSelectConversation={handleSelectConversation}
      onBackToList={handleBackToList}
      threadSlot={<Outlet />}
    />
  )
}
