import { ChannelList } from '@/features/channels/components'
import { m } from '@/paraglide/messages'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/workspaces/$id/settings/channels/',
)({
  component: RouteComponent,
  staticData: {
    crumb: () => ({ label: m.app_breadcrumbs_channels() }),
  },
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <ChannelList workspaceId={id} />
}
