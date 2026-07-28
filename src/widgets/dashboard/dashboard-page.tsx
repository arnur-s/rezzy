import { Loader } from '@/components/loader'
import { AttentionList } from '@/features/dashboard/components/attention-list'
import { DashboardHeader } from '@/features/dashboard/components/dashboard-header'
import { SectionError } from '@/features/dashboard/components/section-error'
import { SingleWorkspaceSummary } from '@/features/dashboard/components/single-workspace-summary'
import { UnassignedList } from '@/features/dashboard/components/unassigned-list'
import { WorkspaceGrid } from '@/features/dashboard/components/workspace-grid'
import {
  useAttentionQueue,
  useUnassignedQueue,
} from '@/features/dashboard/hooks/use-attention-queue'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { useHomeStats } from '@/features/dashboard/hooks/use-home-stats'
import { CreateWorkspaceModal } from '@/features/workspaces/components/create-workspace-modal'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { useMemo, useState } from 'react'

/** Page-level dashboard composition. Features retain ownership of their queries. */
export function DashboardPage() {
  const { user } = useAuth()
  const userId = user?.id

  const workspacesQuery = useWorkspaces(userId)
  const workspaceIds = useMemo(
    () => workspacesQuery.data?.map((w) => w.id) ?? [],
    [workspacesQuery.data],
  )
  const dashboardStatsQuery = useDashboardStats(workspaceIds)
  const homeStatsQuery = useHomeStats(userId, workspaceIds)
  const attentionQuery = useAttentionQueue(userId, workspaceIds)
  const unassignedQuery = useUnassignedQueue(workspaceIds)

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const workspaces = workspacesQuery.data ?? []
  const inboxWorkspaceId = workspaces.length === 1 ? workspaces[0].id : null

  // The summary line and the attention list read the same numbers, so at zero
  // they both render an all-clear. Only the summary should say it.
  const homeStats = homeStatsQuery.data
  const isSummaryAllClear =
    !homeStatsQuery.isPending &&
    !homeStatsQuery.isError &&
    homeStats !== undefined &&
    homeStats.unreadAssigned === 0 &&
    homeStats.openAssigned === 0 &&
    homeStats.snoozedWaking === 0 &&
    homeStats.staleAssigned === 0

  // Each section owns its loading and failure honestly; the page-level gate
  // covers only the workspace list every section depends on. `isPending` (not
  // `isFetching`) keeps refetches from flashing the empty or wrong layout.
  return (
    <>
      {workspacesQuery.isError ? (
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:py-8">
          <SectionError
            message={m.dashboard_load_error_title()}
            onRetry={() => void workspacesQuery.refetch()}
            isRetrying={workspacesQuery.isRefetching}
          />
        </div>
      ) : workspacesQuery.isPending ? (
        <Loader size="lg" />
      ) : workspaces.length === 0 ? (
        <HomeEmptyState onCreate={() => setIsCreateOpen(true)} />
      ) : user ? (
        <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-6 md:py-8">
          <DashboardHeader
            user={user}
            stats={homeStatsQuery.data}
            isPending={homeStatsQuery.isPending}
            isError={homeStatsQuery.isError}
            onRetry={() => void homeStatsQuery.refetch()}
            isRetrying={homeStatsQuery.isRefetching}
            inboxWorkspaceId={inboxWorkspaceId}
          />

          <AttentionList
            items={attentionQuery.data?.items ?? []}
            total={attentionQuery.data?.total ?? 0}
            workspaces={workspaces}
            isLoading={attentionQuery.isPending}
            isError={attentionQuery.isError}
            onRetry={() => void attentionQuery.refetch()}
            isRetrying={attentionQuery.isRefetching}
            inboxWorkspaceId={inboxWorkspaceId}
            isSummaryAllClear={isSummaryAllClear}
          />

          <UnassignedList
            items={unassignedQuery.data ?? []}
            workspaces={workspaces}
            isPending={unassignedQuery.isPending}
            isError={unassignedQuery.isError}
            onRetry={() => void unassignedQuery.refetch()}
            isRetrying={unassignedQuery.isRefetching}
          />

          {workspaces.length === 1 ? (
            <SingleWorkspaceSummary
              workspace={workspaces[0]}
              stats={
                dashboardStatsQuery.data?.perWorkspace.find(
                  (s) => s.workspaceId === workspaces[0].id,
                ) ?? null
              }
              statsPending={dashboardStatsQuery.isPending}
              statsError={dashboardStatsQuery.isError}
              onRetryStats={() => void dashboardStatsQuery.refetch()}
              isRetryingStats={dashboardStatsQuery.isRefetching}
              onCreate={() => setIsCreateOpen(true)}
            />
          ) : (
            <section
              aria-labelledby="home-workspaces-title"
              className="space-y-3"
            >
              <h2
                id="home-workspaces-title"
                className="text-primary text-sm font-semibold"
              >
                {m.home_workspaces_section_title()}
              </h2>
              <WorkspaceGrid
                workspaces={workspaces}
                stats={dashboardStatsQuery.data?.perWorkspace ?? []}
                statsPending={dashboardStatsQuery.isPending}
                statsError={dashboardStatsQuery.isError}
                onRetryStats={() => void dashboardStatsQuery.refetch()}
                isRetryingStats={dashboardStatsQuery.isRefetching}
                onCreate={() => setIsCreateOpen(true)}
              />
            </section>
          )}
        </div>
      ) : null}

      {/* Astryx Dialog is controlled and must be mounted before isOpen flips;
          the icon picker gates its own heavy content instead. */}
      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </>
  )
}

function HomeEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <EmptyState
        title={m.dashboard_empty_title()}
        description={m.dashboard_empty_description()}
        actions={
          <Button
            label={m.dashboard_empty_cta()}
            variant="primary"
            onClick={onCreate}
          />
        }
      />
    </div>
  )
}
