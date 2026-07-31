import type { Workspace } from '@/entities/workspace'
import type { UnassignedItem } from '@/features/dashboard/api/attention-queue'
import { DashboardConversationRow } from '@/features/dashboard/components/dashboard-conversation-row'
import { DashboardSkeletonRows } from '@/features/dashboard/components/dashboard-skeleton'
import { SectionError } from '@/features/dashboard/components/section-error'
import { SectionHeading } from '@/features/dashboard/components/section-heading'
import { formatRelativeTime } from '@/features/dashboard/utils/format-relative-time'
import { m } from '@/paraglide/messages'
import { List } from '@/components/list'
import { useMemo } from 'react'

type Props = {
  items: Array<UnassignedItem>
  workspaces: Array<Workspace>
  isPending: boolean
  isError: boolean
  onRetry: () => void
  isRetrying?: boolean
}

/**
 * Open conversations nobody has picked up. The section still renders nothing
 * when there is nothing to say — silence means nothing is waiting — but it no
 * longer disappears while loading.
 *
 * Returning `null` during `isPending` meant the section materialized after its
 * query resolved and shoved the workspace section down the page, which
 * undercut an otherwise careful loading story. It now reserves its slot with
 * the same skeleton the rest of home uses, and collapses only once it knows
 * the answer is "nothing".
 */
export function UnassignedList({
  items,
  workspaces,
  isPending,
  isError,
  onRetry,
  isRetrying = false,
}: Props) {
  const workspaceNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of workspaces) map.set(w.id, w.name)
    return map
  }, [workspaces])

  const showWorkspaceName = workspaces.length > 1

  if (!isPending && !isError && items.length === 0) return null

  return (
    <section aria-labelledby="home-unassigned-title" className="space-y-3">
      {/* The definition used to live in a `title` attribute, so the one group
          of people who could act on this section could not read what it was. */}
      <SectionHeading
        id="home-unassigned-title"
        title={m.home_unassigned_title()}
        description={m.home_unassigned_hint()}
      />

      {isPending ? (
        <DashboardSkeletonRows count={2} />
      ) : isError ? (
        <SectionError
          message={m.home_unassigned_error()}
          onRetry={onRetry}
          isRetrying={isRetrying}
        />
      ) : (
        <List size="md">
          {items.map((item) => (
            <DashboardConversationRow
              key={item.conversationId}
              conversationId={item.conversationId}
              workspaceId={item.workspaceId}
              contactName={item.contactName}
              channelType={item.channelType}
              preview={item.preview}
              timestampLabel={formatRelativeTime(item.timestamp)}
              workspaceName={
                showWorkspaceName
                  ? workspaceNameById.get(item.workspaceId)
                  : undefined
              }
            />
          ))}
        </List>
      )}
    </section>
  )
}
