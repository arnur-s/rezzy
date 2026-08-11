import { AppPane } from '@/components/app-pane'
import { ContactFormDialog, ContactsPage } from '@/features/contacts'
import type { ContactListParams } from '@/features/contacts'
import { m } from '@/paraglide/messages'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute(
  '/_authenticated/workspaces/$id/contacts/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { id: workspaceId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // The URL is the single source of truth for list state; this maps its shape
  // onto the params the feature and the RPC speak.
  const params: ContactListParams = {
    query: search.query,
    statuses: search.status,
    tags: [],
    ownerIds: search.owner,
    includeUnowned: search.unowned,
    sort: search.sort,
    page: search.page,
  }

  return (
    <AppPane as="section" label={m.contacts_title()}>
      <ContactsPage
        workspaceId={workspaceId}
        params={params}
        isArchived={search.archived}
        isDuplicates={search.duplicates}
        onParamsChange={(patch) =>
          void navigate({
            to: '/workspaces/$id/contacts',
            params: { id: workspaceId },
            // Built from the route's own search rather than a spread of the
            // updater's `previous`, which is typed as the union across sibling
            // routes and would carry unrelated keys through.
            search: {
              query: patch.query ?? search.query,
              status: patch.statuses ?? search.status,
              owner: patch.ownerIds ?? search.owner,
              unowned: patch.includeUnowned ?? search.unowned,
              sort: patch.sort ?? search.sort,
              page: patch.page ?? search.page,
              archived: patch.archived ?? search.archived,
              duplicates: patch.duplicates ?? search.duplicates,
            },
            // List state is navigation, not history: paging and filtering should
            // not stack up entries the back button has to walk through.
            replace: true,
          })
        }
        onCreate={() => setIsCreateOpen(true)}
      />

      <ContactFormDialog
        workspaceId={workspaceId}
        contact={null}
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </AppPane>
  )
}
