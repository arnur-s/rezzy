import { WorkspaceMembersSection } from '@/features/workspaces/components/workspace-members-section'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/workspaces/$id/settings/members',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <WorkspaceMembersSection workspaceId={id} />
}
