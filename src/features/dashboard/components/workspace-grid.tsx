import type { WorkspaceDashboardStats } from '@/features/dashboard/api/dashboard-stats'
import type { Workspace } from '@/entities/workspace'
import { SectionError } from '@/features/dashboard/components/section-error'
import { m } from '@/paraglide/messages'
import { Card } from '@astryxdesign/core/Card'
import { PlusIcon } from 'lucide-react'
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

  if (statsPending) {
    return (
      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {workspaces.map((workspace) => (
          <div
            key={workspace.id}
            className="bg-primary/5 h-32 animate-pulse rounded-lg"
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

        <button
          type="button"
          onClick={onCreate}
          className="group rounded-lg text-left outline-none transition focus-visible:ring-2 focus-visible:ring-accent hover:-translate-y-0.5 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <Card variant="muted" height="100%">
            <div className="flex h-full min-h-24 flex-col items-center justify-center gap-2">
              <span
                aria-hidden="true"
                className="bg-primary/5 text-secondary flex size-8 items-center justify-center rounded-full"
              >
                <PlusIcon className="size-4" />
              </span>
              <span className="text-secondary group-hover:text-primary text-sm font-medium transition-colors">
                {m.dashboard_empty_cta()}
              </span>
            </div>
          </Card>
        </button>
      </div>
    </div>
  )
}
