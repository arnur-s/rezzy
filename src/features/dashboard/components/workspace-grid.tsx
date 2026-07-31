import type { WorkspaceDashboardStats } from '@/features/dashboard/api/dashboard-stats'
import type { Workspace } from '@/entities/workspace'
import { DashboardSkeletonRows } from '@/features/dashboard/components/dashboard-skeleton'
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

        <button
          type="button"
          onClick={onCreate}
          className="group rounded-lg text-left outline-none transition focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.99] motion-reduce:transition-none"
        >
          {/* `transparent` + a dashed border, not `muted`. In light mode the
              card background is #FFFFFF (raised above the page) while the muted
              fill is #D8E2E9 (recessed below it), so a muted tile sitting beside
              real workspace cards pointed elevation in two directions at once.
              An empty slot should read as an outline, which is also the pattern
              the channel-connect surfaces already use. */}
          <Card variant="transparent" height="100%">
            <div className="border-strong/60 group-hover:border-strong flex h-full min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed transition-colors motion-reduce:transition-none">
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
