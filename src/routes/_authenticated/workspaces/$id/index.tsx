import { useRecordWorkspaceVisit } from '@/features/dashboard/hooks/use-record-recent-visit'
import { WorkspaceOverviewPage } from '@/features/workspaces/components/workspace-overview-page'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { useAuth } from '@/providers/auth-provider'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/$id/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const workspacesQuery = useWorkspaces(user?.id)
  const workspace = workspacesQuery.data?.find((w) => w.id === id)
  useRecordWorkspaceVisit(id, workspace?.name, workspace?.icon)
  return <WorkspaceOverviewPage />
}
