import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { useNavigate, useParams } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'

export function WorkspaceOverviewPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const workspaceId = params.id

  return (
    <div className="flex h-full w-full items-center justify-center">
      <EmptyState
        icon={<LayoutDashboard className="text-secondary size-8" />}
        title={m.workspace_overview_empty_title()}
        description={m.workspace_overview_empty_description()}
        actions={
          workspaceId ? (
            <Button
              label={m.workspace_overview_open_inbox()}
              variant="secondary"
              onClick={() =>
                void navigate({
                  to: '/workspaces/$id/inbox',
                  params: { id: workspaceId },
                })
              }
            />
          ) : undefined
        }
      />
    </div>
  )
}
