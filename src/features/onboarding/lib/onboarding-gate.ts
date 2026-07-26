/**
 * Redirect decisions for the two routes that care about onboarding.
 *
 * Both resolvers read the same workspace query, so they can never disagree and
 * bounce a user between `/onboarding` and the app. An unsettled auth session or
 * workspace query always resolves to `loading`, and a failed query resolves to
 * `error` (a retryable screen) rather than to a redirect — a redirect on failure
 * is what turns a flaky network into an infinite loop.
 */
export type OnboardingGateInput = {
  isAuthLoading: boolean
  hasSession: boolean
  isStatusPending: boolean
  isStatusError: boolean
  isOnboarded: boolean
}

export type AppGate = 'loading' | 'sign-in' | 'error' | 'onboarding' | 'allow'

export type OnboardingGate = 'loading' | 'sign-in' | 'error' | 'inbox' | 'allow'

export function resolveAppGate({
  isAuthLoading,
  hasSession,
  isStatusPending,
  isStatusError,
  isOnboarded,
}: OnboardingGateInput): AppGate {
  if (isAuthLoading) {
    return 'loading'
  }

  if (!hasSession) {
    return 'sign-in'
  }

  if (isStatusPending) {
    return 'loading'
  }

  if (isStatusError) {
    return 'error'
  }

  return isOnboarded ? 'allow' : 'onboarding'
}

export function resolveOnboardingGate({
  isAuthLoading,
  hasSession,
  isStatusPending,
  isStatusError,
  isOnboarded,
}: OnboardingGateInput): OnboardingGate {
  if (isAuthLoading) {
    return 'loading'
  }

  if (!hasSession) {
    return 'sign-in'
  }

  if (isStatusPending) {
    return 'loading'
  }

  if (isStatusError) {
    return 'error'
  }

  return isOnboarded ? 'inbox' : 'allow'
}
