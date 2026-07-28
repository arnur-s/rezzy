import type { HomeStats } from '@/features/dashboard/api/home-stats'
import { GreetingHeader } from '@/features/dashboard/components/greeting-header'
import { HomeSummaryLine } from '@/features/dashboard/components/home-summary-line'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { useNavigate } from '@tanstack/react-router'
import type { User } from '@supabase/supabase-js'

type Props = {
  user: User
  stats: HomeStats | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
  isRetrying?: boolean
  /** Present when the user has exactly one workspace, so the header can offer a direct door. */
  inboxWorkspaceId: string | null
}

/**
 * Greeting, the operational summary, and the page's one primary action.
 * "Open inbox" only exists when there is exactly one workspace — with several,
 * there is no single inbox to open and the workspace cards are the doors.
 */
export function DashboardHeader({
  user,
  stats,
  isPending,
  isError,
  onRetry,
  isRetrying = false,
  inboxWorkspaceId,
}: Props) {
  const navigate = useNavigate()

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1 basis-64 space-y-2">
        <GreetingHeader user={user} />
        <HomeSummaryLine
          stats={stats}
          isPending={isPending}
          isError={isError}
          onRetry={onRetry}
          isRetrying={isRetrying}
        />
      </div>
      {inboxWorkspaceId ? (
        <Button
          label={m.home_open_inbox()}
          variant="primary"
          size="sm"
          onClick={() =>
            void navigate({
              to: '/workspaces/$id/inbox',
              params: { id: inboxWorkspaceId },
            })
          }
        />
      ) : null}
    </header>
  )
}
