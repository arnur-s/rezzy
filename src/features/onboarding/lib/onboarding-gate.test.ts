import { describe, expect, it } from 'vitest'
import type { OnboardingGateInput } from './onboarding-gate'
import { resolveAppGate, resolveOnboardingGate } from './onboarding-gate'

const settledAndOnboarded: OnboardingGateInput = {
  isAuthLoading: false,
  hasSession: true,
  isStatusPending: false,
  isStatusError: false,
  isOnboarded: true,
}

describe('resolveAppGate', () => {
  it('waits while the auth session is loading', () => {
    expect(
      resolveAppGate({ ...settledAndOnboarded, isAuthLoading: true }),
    ).toBe('loading')
  })

  it('sends signed-out users to sign in', () => {
    expect(resolveAppGate({ ...settledAndOnboarded, hasSession: false })).toBe(
      'sign-in',
    )
  })

  it('waits while the onboarding status is still loading', () => {
    expect(
      resolveAppGate({
        ...settledAndOnboarded,
        isStatusPending: true,
        isOnboarded: false,
      }),
    ).toBe('loading')
  })

  it('shows a retryable error instead of redirecting when the status fails', () => {
    expect(
      resolveAppGate({
        ...settledAndOnboarded,
        isStatusError: true,
        isOnboarded: false,
      }),
    ).toBe('error')
  })

  it('redirects users who have not completed onboarding', () => {
    expect(resolveAppGate({ ...settledAndOnboarded, isOnboarded: false })).toBe(
      'onboarding',
    )
  })

  it('lets onboarded users through', () => {
    expect(resolveAppGate(settledAndOnboarded)).toBe('allow')
  })
})

describe('resolveOnboardingGate', () => {
  it('waits while the auth session is loading', () => {
    expect(
      resolveOnboardingGate({ ...settledAndOnboarded, isAuthLoading: true }),
    ).toBe('loading')
  })

  it('sends signed-out users to sign in', () => {
    expect(
      resolveOnboardingGate({ ...settledAndOnboarded, hasSession: false }),
    ).toBe('sign-in')
  })

  it('waits while the onboarding status is still loading', () => {
    expect(
      resolveOnboardingGate({
        ...settledAndOnboarded,
        isStatusPending: true,
        isOnboarded: false,
      }),
    ).toBe('loading')
  })

  it('shows a retryable error instead of redirecting when the status fails', () => {
    expect(
      resolveOnboardingGate({ ...settledAndOnboarded, isStatusError: true }),
    ).toBe('error')
  })

  it('sends users who already onboarded to the inbox', () => {
    expect(resolveOnboardingGate(settledAndOnboarded)).toBe('inbox')
  })

  it('shows the form to users who still need to onboard', () => {
    expect(
      resolveOnboardingGate({ ...settledAndOnboarded, isOnboarded: false }),
    ).toBe('allow')
  })
})

describe('the two gates together', () => {
  // Both resolvers read the same query, so no combination of inputs may send a
  // user from the app to onboarding and straight back again.
  const inputs: Array<OnboardingGateInput> = [false, true].flatMap(
    (isAuthLoading) =>
      [false, true].flatMap((hasSession) =>
        [false, true].flatMap((isStatusPending) =>
          [false, true].flatMap((isStatusError) =>
            [false, true].map((isOnboarded) => ({
              isAuthLoading,
              hasSession,
              isStatusPending,
              isStatusError,
              isOnboarded,
            })),
          ),
        ),
      ),
  )

  it('never redirects in both directions for the same state', () => {
    for (const input of inputs) {
      const bouncesBothWays =
        resolveAppGate(input) === 'onboarding' &&
        resolveOnboardingGate(input) === 'inbox'

      expect(bouncesBothWays).toBe(false)
    }
  })
})
