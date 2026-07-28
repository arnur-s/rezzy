import { WorkspaceOverviewPage } from '@/features/workspaces/components/workspace-overview-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/$id/')({
  component: WorkspaceOverviewPage,
})
