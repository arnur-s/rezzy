import type { Workspace } from '@/entities/workspace'
import type { UnassignedItem } from '@/features/dashboard/api/attention-queue'
import { DashboardConversationRow } from '@/features/dashboard/components/dashboard-conversation-row'
import { SectionError } from '@/features/dashboard/components/section-error'
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
 * Unassigned open conversations nobody has picked up. The section renders only
 * when it has something to say — no skeleton, no empty celebration; silence
 * means nothing is waiting.
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

  if (isPending) return null
  if (!isError && items.length === 0) return null

  return (
    <section aria-labelledby="home-unassigned-title" className="space-y-3">
      <h2
        id="home-unassigned-title"
        title={m.home_unassigned_hint()}
        className="text-primary text-sm font-semibold"
      >
        {m.home_unassigned_title()}
      </h2>

      {isError ? (
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
