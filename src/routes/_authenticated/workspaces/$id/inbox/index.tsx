import { MessageThreadEmpty } from '@/features/inbox/components/message-thread/message-thread-empty'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/$id/inbox/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageThreadEmpty />
    </div>
  )
}
