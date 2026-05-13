import { WorkspaceMembersStub } from '@/features/workspaces/components/workspace-members-stub'
import { m } from '@/paraglide/messages'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/workspaces/$id/settings/members',
)({
  component: RouteComponent,
  staticData: {
    crumb: () => ({ label: m.app_breadcrumbs_members() }),
  },
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <WorkspaceMembersStub workspaceId={id} />
}
