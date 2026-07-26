/**
 * Redirect decisions for the routes that care about setup progress.
 *
 * Every resolver reads the same workspace query, so they can never disagree and
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

/** Adds the channel readiness the inbox needs on top of onboarding status. */
export type InboxGateInput = OnboardingGateInput & {
  isReadinessPending: boolean
  isReadinessError: boolean
  hasActiveChannel: boolean
}

export type AppGate = 'loading' | 'sign-in' | 'error' | 'onboarding' | 'allow'

export type OnboardingGate = 'loading' | 'sign-in' | 'error' | 'inbox' | 'allow'

export type InboxGate =
  | 'loading'
  | 'sign-in'
  | 'error'
  | 'onboarding'
  | 'channels'
  | 'allow'

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

/**
 * Guards the inbox, which is unusable until the workspace can receive messages.
 *
 * Onboarding status is checked before channel readiness so a user with no
 * workspace at all is sent to onboarding rather than to the channel settings of
 * a workspace that does not exist.
 */
export function resolveInboxGate({
  isAuthLoading,
  hasSession,
  isStatusPending,
  isStatusError,
  isOnboarded,
  isReadinessPending,
  isReadinessError,
  hasActiveChannel,
}: InboxGateInput): InboxGate {
  const appGate = resolveAppGate({
    isAuthLoading,
    hasSession,
    isStatusPending,
    isStatusError,
    isOnboarded,
  })

  // Deferring to resolveAppGate is what keeps the two in step: the inbox can
  // never allow a state the shell around it would redirect.
  if (appGate !== 'allow') {
    return appGate
  }

  if (isReadinessPending) {
    return 'loading'
  }

  if (isReadinessError) {
    return 'error'
  }

  return hasActiveChannel ? 'allow' : 'channels'
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
