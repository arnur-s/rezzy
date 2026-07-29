import { getActiveTimeZone, subscribeToTimeZone } from '@/lib/time-zone'
import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { accountQueryKeys } from '../api/query-keys'
import type { UserProfile } from '../model/types'
import { useMyIdentity } from './use-my-identity'
import { useSyncTimeZone } from './use-time-zone'

const USER_ID = 'user-1'

const hoisted = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
}))

vi.mock('../api/profile', () => ({
  getMyProfile: hoisted.getMyProfile,
  getMyWorkspaceMemberships: vi.fn(),
  updateMyProfileIdentity: vi.fn(),
  updateMyAvatarUrl: vi.fn(),
  updateMyLanguage: vi.fn(),
}))

// The name here is the one written at sign-up and never updated since, which is
// exactly the value these hooks exist to stop the app from showing.
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: USER_ID,
      email: 'agent@example.com',
      user_metadata: { full_name: 'Old Signup Name' },
    },
    session: null,
    isLoading: false,
    signOut: vi.fn(),
  }),
}))

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: USER_ID,
    fullName: 'Ada Lovelace',
    email: 'agent@example.com',
    avatarUrl: null,
    jobTitle: null,
    phone: null,
    timezone: null,
    language: 'auto',
    ...overrides,
  }
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function IdentityProbe() {
  const identity = useMyIdentity()

  return (
    <div>
      <span data-testid="name">{identity.displayName}</span>
      <span data-testid="avatar">{identity.avatarUrl ?? 'none'}</span>
      <span data-testid="initials">{identity.initials}</span>
    </div>
  )
}

function TimeZoneProbe() {
  useSyncTimeZone()
  return null
}

describe('useMyIdentity', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
    hoisted.getMyProfile.mockResolvedValue(profile())
  })

  it('prefers the saved profile name over frozen auth metadata', async () => {
    render(<IdentityProbe />, { wrapper: wrapper(queryClient) })

    // Before the row lands there is nothing but auth metadata to show.
    expect(screen.getByTestId('name').textContent).toBe('Old Signup Name')

    await waitFor(() =>
      expect(screen.getByTestId('name').textContent).toBe('Ada Lovelace'),
    )
  })

  it('exposes the uploaded avatar so surfaces can render it', async () => {
    hoisted.getMyProfile.mockResolvedValue(
      profile({ avatarUrl: 'https://cdn.example.com/a.png' }),
    )

    render(<IdentityProbe />, { wrapper: wrapper(queryClient) })

    await waitFor(() =>
      expect(screen.getByTestId('avatar').textContent).toBe(
        'https://cdn.example.com/a.png',
      ),
    )
  })

  it('falls back past a blank saved name rather than rendering nothing', async () => {
    // A row seeded from an empty sign-up field holds '' rather than null.
    hoisted.getMyProfile.mockResolvedValue(profile({ fullName: '   ' }))

    render(<IdentityProbe />, { wrapper: wrapper(queryClient) })

    await waitFor(() =>
      expect(screen.getByTestId('name').textContent).toBe('Old Signup Name'),
    )
    expect(screen.getByTestId('initials').textContent).toBe('OS')
  })
})

describe('useSyncTimeZone', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('publishes the account zone so every formatter picks it up', async () => {
    hoisted.getMyProfile.mockResolvedValue(profile({ timezone: 'Asia/Tokyo' }))

    render(<TimeZoneProbe />, { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(getActiveTimeZone()).toBe('Asia/Tokyo'))
  })

  it('leaves the browser zone in place when the account has none', async () => {
    hoisted.getMyProfile.mockResolvedValue(profile({ timezone: null }))

    render(<TimeZoneProbe />, { wrapper: wrapper(queryClient) })

    await waitFor(() =>
      expect(
        queryClient.getQueryData(accountQueryKeys.profile(USER_ID)),
      ).toBeDefined(),
    )
    expect(getActiveTimeZone()).toBeUndefined()
  })

  it('ignores a stored zone the runtime cannot resolve', async () => {
    hoisted.getMyProfile.mockResolvedValue(
      profile({ timezone: 'Mars/Olympus_Mons' }),
    )

    render(<TimeZoneProbe />, { wrapper: wrapper(queryClient) })

    await waitFor(() =>
      expect(
        queryClient.getQueryData(accountQueryKeys.profile(USER_ID)),
      ).toBeDefined(),
    )
    expect(getActiveTimeZone()).toBeUndefined()
  })

  it('releases the zone on sign-out so the next account starts clean', async () => {
    hoisted.getMyProfile.mockResolvedValue(profile({ timezone: 'Asia/Tokyo' }))

    const view = render(<TimeZoneProbe />, { wrapper: wrapper(queryClient) })
    await waitFor(() => expect(getActiveTimeZone()).toBe('Asia/Tokyo'))

    // Signing out unmounts the authenticated area. The store is module-level,
    // so without a reset the next account would inherit this zone.
    view.unmount()

    expect(getActiveTimeZone()).toBeUndefined()
  })

  it('survives the double-mount StrictMode subjects it to', async () => {
    // The release is a separate effect, so a StrictMode mount runs apply,
    // release, apply. The zone still has to be in place at the end of it.
    hoisted.getMyProfile.mockResolvedValue(profile({ timezone: 'Asia/Tokyo' }))

    const Wrapper = wrapper(queryClient)
    render(
      <StrictMode>
        <Wrapper>
          <TimeZoneProbe />
        </Wrapper>
      </StrictMode>,
    )

    await waitFor(() => expect(getActiveTimeZone()).toBe('Asia/Tokyo'))
  })

  it('never publishes a null on the way between two real zones', async () => {
    // Why the release is its own effect rather than a cleanup on the one that
    // applies the zone. Both land on the right value, but a cleanup would emit
    // a `null` between them on every change, waking every subscriber for a
    // state the account was never in — a visible flash back to machine-local
    // time on any screen showing timestamps.
    hoisted.getMyProfile.mockResolvedValue(profile({ timezone: 'Europe/Rome' }))

    render(<TimeZoneProbe />, { wrapper: wrapper(queryClient) })
    await waitFor(() => expect(getActiveTimeZone()).toBe('Europe/Rome'))

    const seen: Array<string | undefined> = []
    const unsubscribe = subscribeToTimeZone(() => {
      seen.push(getActiveTimeZone())
    })

    queryClient.setQueryData(
      accountQueryKeys.profile(USER_ID),
      profile({ timezone: 'Asia/Tokyo' }),
    )

    await waitFor(() => expect(getActiveTimeZone()).toBe('Asia/Tokyo'))
    unsubscribe()

    expect(seen).toEqual(['Asia/Tokyo'])
  })
})
