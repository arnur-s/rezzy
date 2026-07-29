import { getActiveTimeZone } from '@/lib/time-zone'
import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMyIdentity } from '../hooks/use-my-identity'
import { useSyncTimeZone } from '../hooks/use-time-zone'
import { useUpdateMyProfile } from '../hooks/use-my-profile'
import { useUpdateAvatar } from '../hooks/use-avatar'
import type { UserProfile } from '../model/types'

const USER_ID = 'user-1'

const hoisted = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  updateMyProfileIdentity: vi.fn(),
  updateMyAvatarUrl: vi.fn(),
  uploadAvatar: vi.fn(),
  removeAvatarObject: vi.fn(),
}))

vi.mock('../api/profile', () => ({
  getMyProfile: hoisted.getMyProfile,
  updateMyProfileIdentity: hoisted.updateMyProfileIdentity,
  updateMyAvatarUrl: hoisted.updateMyAvatarUrl,
  getMyWorkspaceMemberships: vi.fn(),
  updateMyLanguage: vi.fn(),
}))

vi.mock('../api/avatar', () => ({
  uploadAvatar: hoisted.uploadAvatar,
  removeAvatarObject: hoisted.removeAvatarObject,
}))

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

/**
 * Stands in for the whole app: something that saves the profile, and the
 * surfaces that have to follow it. They share only the query cache, which is
 * exactly the coupling under test.
 */
function Harness() {
  const identity = useMyIdentity()
  const update = useUpdateMyProfile()
  useSyncTimeZone()

  return (
    <div>
      <span data-testid="name">{identity.displayName}</span>
      <span data-testid="avatar">{identity.avatarUrl ?? 'none'}</span>
      <button
        type="button"
        onClick={() =>
          update.mutate({
            fullName: 'Ada King',
            jobTitle: null,
            phone: null,
            timezone: 'Asia/Tokyo',
          })
        }
      >
        save
      </button>
    </div>
  )
}

function AvatarHarness() {
  const identity = useMyIdentity()
  const update = useUpdateAvatar()

  return (
    <div>
      <span data-testid="avatar">{identity.avatarUrl ?? 'none'}</span>
      <button
        type="button"
        onClick={() =>
          update.mutate(new File(['x'], 'me.png', { type: 'image/png' }))
        }
      >
        upload
      </button>
    </div>
  )
}

/**
 * The point of the whole feature: saving the profile has to change what the
 * rest of the app shows. Every other test in this area mocks the mutation, so
 * without this one nothing proves the write reaches the surfaces that read it.
 */
describe('saving the profile propagates through the app', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
    hoisted.getMyProfile.mockResolvedValue(profile())
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('moves the name and the zone that other surfaces read', async () => {
    hoisted.updateMyProfileIdentity.mockResolvedValue(
      profile({ fullName: 'Ada King', timezone: 'Asia/Tokyo' }),
    )

    render(<Harness />, { wrapper: wrapper(queryClient) })

    await waitFor(() =>
      expect(screen.getByTestId('name').textContent).toBe('Ada Lovelace'),
    )
    expect(getActiveTimeZone()).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    // One save, two surfaces: the name every screen shows, and the zone every
    // timestamp is formatted in.
    await waitFor(() =>
      expect(screen.getByTestId('name').textContent).toBe('Ada King'),
    )
    await waitFor(() => expect(getActiveTimeZone()).toBe('Asia/Tokyo'))
  })

  it('moves the uploaded picture that other surfaces read', async () => {
    hoisted.uploadAvatar.mockResolvedValue('https://cdn.example.com/me.png')
    hoisted.updateMyAvatarUrl.mockResolvedValue(
      profile({ avatarUrl: 'https://cdn.example.com/me.png' }),
    )

    render(<AvatarHarness />, { wrapper: wrapper(queryClient) })

    await waitFor(() =>
      expect(screen.getByTestId('avatar').textContent).toBe('none'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'upload' }))

    await waitFor(() =>
      expect(screen.getByTestId('avatar').textContent).toBe(
        'https://cdn.example.com/me.png',
      ),
    )
  })
})
