import type { Workspace } from '@/entities/workspace'
import type { AttentionItem } from '@/features/dashboard/api/attention-queue'
import type { WorkspaceDashboardStats } from '@/features/dashboard/api/dashboard-stats'

/**
 * Where home's one primary button sends you, and which workspace that is.
 *
 * The button used to exist only when the user had exactly one workspace, on the
 * reasoning that with several there is no single inbox to open. But the
 * attention queue already ranks conversations *across* workspaces, so the
 * product does have an opinion about global priority — it just stopped one
 * level short of the button, leaving the users who most need triage help on the
 * only screen with no primary action at all.
 *
 * The opinion, in order:
 *
 *  1. The workspace holding the most urgent attention item. The queue is
 *     already sorted by reason then age, so its head is the answer to "what do
 *     I do first" and the button should agree with the list underneath it.
 *  2. Failing that (queue empty or still loading), the workspace with the most
 *     unread.
 *  3. Failing that, the first workspace. Something is always openable.
 */
export type HomePrimaryDestination = {
  workspaceId: string
  /** Name of the target, so a multi-workspace label can say where it goes. */
  workspaceName: string
  /** True when the user owns exactly one workspace, so the label can stay short. */
  isOnlyWorkspace: boolean
}

export function resolveHomePrimaryDestination(
  workspaces: Array<Workspace>,
  attentionItems: Array<AttentionItem>,
  stats: Array<WorkspaceDashboardStats>,
): HomePrimaryDestination | null {
  if (workspaces.length === 0) return null

  const byId = new Map(workspaces.map((w) => [w.id, w]))
  const build = (workspace: Workspace): HomePrimaryDestination => ({
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    isOnlyWorkspace: workspaces.length === 1,
  })

  if (workspaces.length === 1) return build(workspaces[0])

  // The queue is pre-sorted, so the first item a workspace claims is the most
  // urgent one on the page. A stale item from a deleted workspace is skipped
  // rather than trusted.
  for (const item of attentionItems) {
    const workspace = byId.get(item.workspaceId)
    if (workspace) return build(workspace)
  }

  let best: { workspace: Workspace; unread: number } | null = null
  for (const entry of stats) {
    const workspace = byId.get(entry.workspaceId)
    if (!workspace || entry.unread <= 0) continue
    if (!best || entry.unread > best.unread) {
      best = { workspace, unread: entry.unread }
    }
  }
  if (best) return build(best.workspace)

  return build(workspaces[0])
}
