import { InboxPage } from '@/features/inbox/components/inbox-page'
import { workspaceCrumbs } from '@/lib/breadcrumbs'
import { m } from '@/paraglide/messages'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/$id/inbox')({
  component: RouteComponent,
  staticData: {
    crumb: (ctx) => [
      ...workspaceCrumbs(ctx),
      { label: m.app_breadcrumbs_inbox() },
    ],
  },
})

function RouteComponent() {
  const { id: workspaceId } = Route.useParams()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <InboxPage workspaceId={workspaceId} />
    </div>
  )
}
