import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'

type Props = {
  isRetrying: boolean
  onRetry: () => void
}

/**
 * Shown when the channel query that decides inbox readiness fails.
 *
 * The inbox route renders this instead of redirecting to channel settings: a
 * failed check is not the same as a workspace without channels, and redirecting
 * on failure is what turns a flaky network into a loop between the two routes.
 */
export function InboxReadinessError({ isRetrying, onRetry }: Props) {
  return (
    <div className="flex h-full w-full items-center justify-center px-4">
      <EmptyState
        title={m.inbox_readiness_error_title()}
        actions={
          <Button
            label={m.common_retry()}
            variant="primary"
            onClick={onRetry}
            isLoading={isRetrying}
          />
        }
      />
    </div>
  )
}
