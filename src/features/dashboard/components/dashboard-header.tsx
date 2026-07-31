import type { HomeStats } from '@/features/dashboard/api/home-stats'
import { GreetingHeader } from '@/features/dashboard/components/greeting-header'
import { HomeSummaryLine } from '@/features/dashboard/components/home-summary-line'
import type { HomePrimaryDestination } from '@/features/dashboard/lib/home-primary-destination'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { useNavigate } from '@tanstack/react-router'

type Props = {
  stats: HomeStats | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
  isRetrying?: boolean
  /**
   * Where the page's one primary action goes. Null only before any workspace
   * exists, which is the empty state and has its own call to action.
   */
  destination: HomePrimaryDestination | null
  /** True while the summary has nothing to report, so the header stays quiet. */
  isAllClear?: boolean
  /** Unclaimed conversations, so the all-clear can stay honest about the team. */
  unassignedCount?: number
}

/**
 * Greeting, the operational summary, and the page's one primary action.
 *
 * The button used to appear only for single-workspace users, which left the
 * people juggling several — the ones who most need triage help — on the only
 * screen in the product with no primary action. It now always points somewhere,
 * and `resolveHomePrimaryDestination` decides where; with several workspaces the
 * label names the one it opens, so the button never navigates somewhere the
 * user did not expect.
 */
export function DashboardHeader({
  stats,
  isPending,
  isError,
  onRetry,
  isRetrying = false,
  destination,
  isAllClear = false,
  unassignedCount = 0,
}: Props) {
  const navigate = useNavigate()

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1 basis-64 space-y-2">
        {/* No `user` prop: the greeting reads the profile row itself, so the
            name it shows follows the profile page rather than sign-up. */}
        <GreetingHeader />
        <HomeSummaryLine
          stats={stats}
          isPending={isPending}
          isError={isError}
          onRetry={onRetry}
          isRetrying={isRetrying}
          unassignedCount={unassignedCount}
        />
      </div>
      {destination ? (
        <Button
          label={
            destination.isOnlyWorkspace
              ? m.home_open_inbox()
              : m.home_open_inbox_workspace({ name: destination.workspaceName })
          }
          // With nothing waiting there is no work to send anyone to, so the
          // door stays available but stops competing with the all-clear.
          variant={isAllClear ? 'secondary' : 'primary'}
          size="sm"
          onClick={() =>
            void navigate({
              to: '/workspaces/$id/inbox',
              params: { id: destination.workspaceId },
            })
          }
        />
      ) : null}
    </header>
  )
}
