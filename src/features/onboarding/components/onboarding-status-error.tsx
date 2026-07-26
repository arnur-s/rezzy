import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'

type Props = {
  isRetrying: boolean
  onRetry: () => void
}

/**
 * Shown when the workspace query that decides onboarding status fails. Both
 * gated routes render this instead of redirecting: redirecting on a failed
 * status check is what turns a flaky network into a loop between the app and
 * the onboarding screen.
 */
export function OnboardingStatusError({ isRetrying, onRetry }: Props) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4">
      <EmptyState
        title={m.onboarding_status_error_title()}
        headingLevel={1}
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
