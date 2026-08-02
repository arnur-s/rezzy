import { AppPane } from '@/components/app-pane'
import { ContactDetailPage } from '@/features/contacts'
import { m } from '@/paraglide/messages'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/workspaces/$id/contacts/$contactId',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { contactId, id: workspaceId } = Route.useParams()

  return (
    <AppPane as="section" label={m.contact_detail_information()}>
      <ContactDetailPage workspaceId={workspaceId} contactId={contactId} />
    </AppPane>
  )
}
