import { InboxPage } from '@/features/inbox/components/inbox-page'
import { workspaceCrumbs } from '@/lib/breadcrumbs'
import { m } from '@/paraglide/messages'
import { Outlet, createFileRoute, useNavigate, useParams } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/$id/inbox')({
  component: RouteComponent,
  staticData: {
    crumb: (ctx) => [...workspaceCrumbs(ctx), { label: m.breadcrumbs_inbox() }],
  },
})

function RouteComponent() {
  const { id: workspaceId } = Route.useParams()
  // strict: false lets the layout read $conversationId, which belongs to the child route
  const allParams = useParams({ strict: false }) as Record<string, string | undefined>
  const selectedConversationId = allParams.conversationId ?? null
  const navigate = useNavigate()

  function handleSelectConversation(conversationId: string) {
    void navigate({
      to: '/workspaces/$id/inbox/$conversationId',
      params: { id: workspaceId, conversationId },
    })
  }

  function handleBackToList() {
    void navigate({
      to: '/workspaces/$id/inbox',
      params: { id: workspaceId },
    })
  }

  return (
    <div className="flex flex-1 h-full min-h-0 flex-col">
      <InboxPage
        workspaceId={workspaceId}
        selectedConversationId={selectedConversationId}
        onSelectConversation={handleSelectConversation}
        onBackToList={handleBackToList}
      />
      <Outlet />
    </div>
  )
}
