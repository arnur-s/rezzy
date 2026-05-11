import { createFileRoute } from '@tanstack/react-router'
import { WorkspaceOverviewPage } from '@/features/workspaces/components/workspace-overview-page'

export const Route = createFileRoute('/_authenticated/workspaces/$id/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <WorkspaceOverviewPage />
}
