import { PlatformIcon } from '@/entities/channel'
import type { Workspace } from '@/entities/workspace'
import type { TeamNewItem } from '@/features/dashboard/api/attention-queue'
import { SectionError } from '@/features/dashboard/components/section-error'
import { formatRelativeTime } from '@/features/dashboard/utils/format-relative-time'
import { m } from '@/paraglide/messages'
import { List } from '@/components/list'
import { Link } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import { useMemo } from 'react'

type Props = {
  items: Array<TeamNewItem>
  workspaces: Array<Workspace>
  isPending: boolean
  isError: boolean
  onRetry: () => void
  isRetrying?: boolean
}

/**
 * "What just arrived": recent unassigned conversations nobody has picked up.
 * The section renders only when it has something to say — no skeleton, no
 * empty celebration; silence means nothing is waiting.
 */
export function TeamNewList({
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

  if (isPending) return null
  if (!isError && items.length === 0) return null

  return (
    <section aria-labelledby="home-team-new-title" className="space-y-3">
      <h2
        id="home-team-new-title"
        title={m.home_team_new_hint()}
        className="text-primary text-sm font-semibold"
      >
        {m.home_team_new_title()}
      </h2>

      {isError ? (
        <SectionError
          message={m.home_team_new_error()}
          onRetry={onRetry}
          isRetrying={isRetrying}
        />
      ) : (
        <List size="md">
          {items.map((item) => (
            <List.Item key={item.conversationId} className="-mx-2">
              <Link
                to="/workspaces/$id/inbox/$conversationId"
                params={{
                  id: item.workspaceId,
                  conversationId: item.conversationId,
                }}
              >
                {item.channelType ? (
                  <PlatformIcon type={item.channelType} size="md" withPlate />
                ) : (
                  <span className="bg-muted size-9 shrink-0 rounded-xl" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-primary truncate text-sm font-semibold">
                    {item.contactName}
                  </p>
                  <p className="text-secondary mt-0.5 flex items-center gap-1.5 truncate text-xs">
                    {workspaceNameById.get(item.workspaceId) ? (
                      <>
                        <span className="truncate">
                          {workspaceNameById.get(item.workspaceId)}
                        </span>
                        {/* Inherits the row's `text-secondary`; the old
                            `text-primary/30` was lighter than its siblings. */}
                        <span aria-hidden="true">·</span>
                      </>
                    ) : null}
                    <span className="tabular-nums">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </p>
                </div>

                <ChevronRightIcon
                  aria-hidden="true"
                  className="text-secondary/70 size-4 shrink-0"
                />
              </Link>
            </List.Item>
          ))}
        </List>
      )}
    </section>
  )
}
