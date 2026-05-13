import { m } from '@/paraglide/messages'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/profile')({
  component: RouteComponent,
  staticData: {
    crumb: () => ({ label: m.app_breadcrumbs_profile() }),
  },
})

function RouteComponent() {
  return null
}
