import { ChannelList } from '@/features/channels/components'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/workspaces/$id/settings/channels/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <ChannelList workspaceId={id} />
}
