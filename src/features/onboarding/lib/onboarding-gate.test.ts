import { describe, expect, it } from 'vitest'
import type { InboxGateInput, OnboardingGateInput } from './onboarding-gate'
import {
  resolveAppGate,
  resolveInboxGate,
  resolveOnboardingGate,
} from './onboarding-gate'

const settledAndOnboarded: OnboardingGateInput = {
  isAuthLoading: false,
  hasSession: true,
  isStatusPending: false,
  isStatusError: false,
  isOnboarded: true,
}

const settledAndReady: InboxGateInput = {
  ...settledAndOnboarded,
  isReadinessPending: false,
  isReadinessError: false,
  hasActiveChannel: true,
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

describe('resolveInboxGate', () => {
  it('waits while the auth session is loading', () => {
    expect(resolveInboxGate({ ...settledAndReady, isAuthLoading: true })).toBe(
      'loading',
    )
  })

  it('sends signed-out users to sign in', () => {
    expect(resolveInboxGate({ ...settledAndReady, hasSession: false })).toBe(
      'sign-in',
    )
  })

  it('waits while the workspace list is still loading', () => {
    expect(
      resolveInboxGate({
        ...settledAndReady,
        isStatusPending: true,
        isOnboarded: false,
        hasActiveChannel: false,
      }),
    ).toBe('loading')
  })

  it('sends users without a workspace to onboarding', () => {
    expect(
      resolveInboxGate({
        ...settledAndReady,
        isOnboarded: false,
        hasActiveChannel: false,
      }),
    ).toBe('onboarding')
  })

  // The channel list decides whether the inbox opens, so an unfinished request
  // must hold the route rather than bounce the user to setup and back.
  it('waits while the channel list is still loading', () => {
    expect(
      resolveInboxGate({
        ...settledAndReady,
        isReadinessPending: true,
        hasActiveChannel: false,
      }),
    ).toBe('loading')
  })

  it('shows a retryable error instead of redirecting when the channel list fails', () => {
    expect(
      resolveInboxGate({
        ...settledAndReady,
        isReadinessError: true,
        hasActiveChannel: false,
      }),
    ).toBe('error')
  })

  it('sends a workspace without an active channel to channel settings', () => {
    expect(
      resolveInboxGate({ ...settledAndReady, hasActiveChannel: false }),
    ).toBe('channels')
  })

  it('opens the inbox once the workspace has an active channel', () => {
    expect(resolveInboxGate(settledAndReady)).toBe('allow')
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

  const inboxInputs: Array<InboxGateInput> = inputs.flatMap((input) =>
    [false, true].flatMap((isReadinessPending) =>
      [false, true].flatMap((isReadinessError) =>
        [false, true].map((hasActiveChannel) => ({
          ...input,
          isReadinessPending,
          isReadinessError,
          hasActiveChannel,
        })),
      ),
    ),
  )

  // `_authenticated` renders the inbox, so it redirects first. Sending a user to
  // channel settings from a state the app shell would bounce to onboarding is a
  // visible flash between two routes.
  it('only sends users to channel settings from states the app shell allows', () => {
    for (const input of inboxInputs) {
      if (resolveInboxGate(input) === 'channels') {
        expect(resolveAppGate(input)).toBe('allow')
      }
    }
  })

  it('never opens the inbox in a state the app shell would redirect', () => {
    for (const input of inboxInputs) {
      if (resolveInboxGate(input) === 'allow') {
        expect(resolveAppGate(input)).toBe('allow')
      }
    }
  })
})
