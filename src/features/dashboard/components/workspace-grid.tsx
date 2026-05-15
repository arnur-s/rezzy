import type { WorkspaceDashboardStats } from '@/features/dashboard/api/dashboard-stats'
import type { Workspace } from '@/entities/workspace'
import { useMemo } from 'react'
import { WorkspaceCard } from './workspace-card'

type Props = {
  workspaces: Array<Workspace>
  stats: Array<WorkspaceDashboardStats>
}

const EMPTY_STATS: Omit<WorkspaceDashboardStats, 'workspaceId'> = {
  unread: 0,
  open: 0,
  channels: 0,
  contacts: 0,
  channelTypes: [],
  lastMessageAt: null,
}

export function WorkspaceGrid({ workspaces, stats }: Props) {
  const statsById = useMemo(() => {
    const map = new Map<string, WorkspaceDashboardStats>()
    for (const entry of stats) {
      map.set(entry.workspaceId, entry)
    }
    return map
  }, [stats])

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {workspaces.map((workspace) => {
        const entry = statsById.get(workspace.id) ?? EMPTY_STATS
        return (
          <WorkspaceCard
            key={workspace.id}
            workspace={workspace}
            unread={entry.unread}
            open={entry.open}
            channels={entry.channels}
            contacts={entry.contacts}
            channelTypes={entry.channelTypes}
            lastMessageAt={entry.lastMessageAt}
          />
        )
      })}
    </div>
  )
}
