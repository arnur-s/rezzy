import { useRecordWorkspaceVisit } from '@/features/dashboard/hooks/use-record-recent-visit'
import { WorkspaceOverviewPage } from '@/features/workspaces/components/workspace-overview-page'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { workspaceCrumbs } from '@/lib/breadcrumbs'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/$id/')({
  component: RouteComponent,
  staticData: {
    crumb: (ctx) => [
      ...workspaceCrumbs(ctx),
      { label: m.app_breadcrumbs_dashboard() },
    ],
  },
})

function RouteComponent() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const workspacesQuery = useWorkspaces(user?.id)
  const workspace = workspacesQuery.data?.find((w) => w.id === id)
  useRecordWorkspaceVisit(id, workspace?.name)
  return <WorkspaceOverviewPage />
}
