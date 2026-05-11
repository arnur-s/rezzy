import { WorkspaceMembersStub } from '@/features/workspaces/components/workspace-members-stub'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/workspaces/$id/settings/members',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <WorkspaceMembersStub workspaceId={id} />
}
