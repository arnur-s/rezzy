import { m } from '@/paraglide/messages'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/')({
  component: RouteComponent,
  staticData: {
    crumb: () => ({ label: m.app_breadcrumbs_workspaces() }),
  },
})

function RouteComponent() {
  return null
}
