import { InboxConversationThread } from '@/features/inbox/components/inbox-conversation-thread'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/workspaces/$id/inbox/$conversationId',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { conversationId } = Route.useParams()
  return <InboxConversationThread conversationId={conversationId} />
}
