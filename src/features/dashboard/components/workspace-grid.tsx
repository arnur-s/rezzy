import type { WorkspaceDashboardStats } from '@/features/dashboard/api/dashboard-stats'
import type { Workspace } from '@/entities/workspace'
import { DashboardSkeletonRows } from '@/features/dashboard/components/dashboard-skeleton'
import { CreateWorkspaceTile } from '@/features/dashboard/components/create-workspace-tile'
import { SectionError } from '@/features/dashboard/components/section-error'
import { m } from '@/paraglide/messages'
import { useMemo } from 'react'
import { WorkspaceCard } from './workspace-card'

type Props = {
  workspaces: Array<Workspace>
  stats: Array<WorkspaceDashboardStats>
  statsPending: boolean
  statsError: boolean
  onRetryStats: () => void
  isRetryingStats?: boolean
  onCreate: () => void
}

export function WorkspaceGrid({
  workspaces,
  stats,
  statsPending,
  statsError,
  onRetryStats,
  isRetryingStats = false,
  onCreate,
}: Props) {
  const statsById = useMemo(() => {
    const map = new Map<string, WorkspaceDashboardStats>()
    for (const entry of stats) {
      map.set(entry.workspaceId, entry)
    }
    return map
  }, [stats])

  // The grid reserves one placeholder per workspace it already knows about,
  // so the cards land in the slots the skeleton was holding rather than
  // resizing the section under the pointer.
  if (statsPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {workspaces.map((workspace) => (
          <DashboardSkeletonRows
            key={workspace.id}
            count={1}
            rowClassName="h-32"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {statsError ? (
        <SectionError
          message={m.home_workspaces_stats_error()}
          onRetry={onRetryStats}
          isRetrying={isRetryingStats}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {workspaces.map((workspace) => (
          <WorkspaceCard
            key={workspace.id}
            workspace={workspace}
            stats={
              statsError ? null : (statsById.get(workspace.id) ?? null)
            }
          />
        ))}

        <CreateWorkspaceTile onCreate={onCreate} />
      </div>
    </div>
  )
}
