import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { CreateWorkspaceModal } from '@/features/workspaces/components/create-workspace-modal'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { Button, Skeleton } from '@heroui/react'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { AggregateStatStrip } from './-components/aggregate-stat-strip'
import { WorkspaceGrid } from './-components/workspace-grid'

export const Route = createFileRoute('/_authenticated/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()
  const userId = user?.id

  const workspacesQuery = useWorkspaces(userId)
  const workspaceIds = useMemo(
    () => workspacesQuery.data?.map((w) => w.id) ?? [],
    [workspacesQuery.data],
  )
  const statsQuery = useDashboardStats(workspaceIds)

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const isLoading = workspacesQuery.isPending || statsQuery.isPending
  const isError = workspacesQuery.isError || statsQuery.isError
  const workspaces = workspacesQuery.data ?? []
  const stats = statsQuery.data

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <p className="text-foreground/50 text-xs uppercase tracking-wide">
          {m.dashboard_page_kicker()}
        </p>
        <h1 className="text-2xl font-semibold">{m.dashboard_page_title()}</h1>
        <p className="text-foreground/60 text-sm">
          {m.dashboard_page_description()}
        </p>
      </header>

      {isError ? (
        <p className="text-danger bg-danger/5 rounded-lg px-4 py-3 text-sm">
          {m.dashboard_load_error_title()}
        </p>
      ) : isLoading ? (
        <DashboardSkeleton />
      ) : workspaces.length === 0 ? (
        <EmptyState onCreate={() => setIsCreateOpen(true)} />
      ) : (
        <>
          <AggregateStatStrip
            unread={stats?.aggregate.unread ?? 0}
            open={stats?.aggregate.open ?? 0}
            channels={stats?.aggregate.channels ?? 0}
            contacts={stats?.aggregate.contacts ?? 0}
          />
          <WorkspaceGrid
            workspaces={workspaces}
            stats={stats?.perWorkspace ?? []}
          />
        </>
      )}

      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="border-foreground/10 mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{m.dashboard_empty_title()}</h2>
      <p className="text-foreground/60 text-sm">
        {m.dashboard_empty_description()}
      </p>
      <Button onPress={onCreate} className="mt-2">
        {m.dashboard_empty_cta()}
      </Button>
    </div>
  )
}
