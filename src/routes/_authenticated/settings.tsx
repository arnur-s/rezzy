import { m } from '@/paraglide/messages'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings')({
  component: RouteComponent,
  staticData: {
    crumb: () => ({ label: m.app_breadcrumbs_app_settings() }),
  },
})

function RouteComponent() {
  return <div>Hello "/_authenticated/settings"!</div>
}
