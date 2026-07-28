import { AppPane } from '@/components/app-pane'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { UsersRoundIcon } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/workspaces/$id/contacts')(
  {
    component: RouteComponent,
  },
)

/**
 * Contacts are managed inside a conversation's contact panel today; there is no
 * standalone directory yet. This route existed as router scaffolding rendering
 * the literal `Hello "/_authenticated/workspaces/$id/contacts"!`, so it is
 * reachable and showed developer scratch text. Until the directory is built, it
 * says what is true and points at the place the data actually lives.
 */
function RouteComponent() {
  const { id: workspaceId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <AppPane className="items-center justify-center">
      <EmptyState
        icon={<UsersRoundIcon className="text-secondary size-8" />}
        title={m.contacts_empty_title()}
        description={m.contacts_empty_description()}
        actions={
          <Button
            label={m.contacts_empty_open_inbox()}
            variant="secondary"
            onClick={() =>
              void navigate({
                to: '/workspaces/$id/inbox',
                params: { id: workspaceId },
              })
            }
          />
        }
      />
    </AppPane>
  )
}
