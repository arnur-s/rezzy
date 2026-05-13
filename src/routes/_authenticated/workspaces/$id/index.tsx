import { workspaceCrumbs } from '@/lib/breadcrumbs'
import { m } from '@/paraglide/messages'
import { createFileRoute } from '@tanstack/react-router'
import { WorkspaceOverviewPage } from '@/features/workspaces/components/workspace-overview-page'

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
  return <WorkspaceOverviewPage />
}
