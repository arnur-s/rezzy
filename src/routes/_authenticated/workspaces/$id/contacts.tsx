import { workspaceCrumbs } from '@/lib/breadcrumbs'
import { m } from '@/paraglide/messages'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/$id/contacts')(
  {
    component: RouteComponent,
    staticData: {
      crumb: (ctx) => [
        ...workspaceCrumbs(ctx),
        { label: m.breadcrumbs_contacts() },
      ],
    },
  },
)

function RouteComponent() {
  return <div>Hello "/_authenticated/workspaces/$id/contacts"!</div>
}
