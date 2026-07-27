import { useInboxThreadRouteContext } from '@/features/inbox/components/inbox-route-context'
import { MessageThreadEmpty } from '@/features/inbox/components/message-thread/message-thread-empty'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/$id/inbox/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { hasNoConversations } = useInboxThreadRouteContext()

  // Occupies the thread region of the inbox layout, flat on the content sheet.
  return (
    <div className="flex h-full w-full min-h-0 flex-col">
      <MessageThreadEmpty hasNoConversations={hasNoConversations} />
    </div>
  )
}
