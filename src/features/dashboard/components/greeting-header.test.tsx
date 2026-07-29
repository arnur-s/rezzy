import { accountQueryKeys } from '@/features/account'
import type { UserProfile } from '@/features/account'
import { setActiveTimeZone } from '@/lib/time-zone'
import { setLocale } from '@/paraglide/runtime'
import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GreetingHeader } from './greeting-header'

const USER_ID = 'user-1'

vi.mock('../../account/api/profile', () => ({
  getMyProfile: vi.fn(),
  getMyWorkspaceMemberships: vi.fn(),
  updateMyProfileIdentity: vi.fn(),
  updateMyAvatarUrl: vi.fn(),
  updateMyLanguage: vi.fn(),
}))

// The sign-up name, which is what the greeting used to show forever.
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

function profile(): UserProfile {
  return {
    id: USER_ID,
    fullName: 'Augusta King',
    email: 'agent@example.com',
    avatarUrl: null,
    jobTitle: null,
    phone: null,
    timezone: null,
    language: 'auto',
  }
}

function renderGreeting(seeded: boolean) {
  const queryClient: QueryClient = createTestQueryClient()

  if (seeded) {
    queryClient.setQueryData(accountQueryKeys.profile(USER_ID), profile())
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  return render(<GreetingHeader />, { wrapper: Wrapper })
}

/**
 * The greeting is the first line of the home page, which makes it the most
 * conspicuous place for the app to be wrong about who you are or where you are.
 * Both were wrong: the name came from auth metadata frozen at sign-up, and the
 * salutation came from the machine's clock rather than the account's zone.
 */
describe('GreetingHeader', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    vi.useFakeTimers()
    // 19:00 UTC: evening in London (BST), the small hours in Tokyo.
    vi.setSystemTime(new Date('2026-05-14T19:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    setActiveTimeZone(null)
  })

  it('greets you by the name you saved, not the one you signed up with', () => {
    renderGreeting(true)

    expect(screen.getByRole('heading').textContent).toContain('Augusta King')
    expect(screen.getByRole('heading').textContent).not.toContain(
      'Old Signup Name',
    )
  })

  it('falls back to auth metadata before the profile row arrives', () => {
    renderGreeting(false)

    expect(screen.getByRole('heading').textContent).toContain('Old Signup Name')
  })

  it('salutes by the account clock rather than the machine clock', () => {
    setActiveTimeZone('Europe/London')
    renderGreeting(true)
    const london = screen.getByRole('heading').textContent

    setActiveTimeZone('Asia/Tokyo')
    renderGreeting(true)
    const tokyo = screen.getAllByRole('heading').at(-1)?.textContent

    // 20:00 in London is an evening; 04:00 in Tokyo is not.
    expect(london).not.toBe(tokyo)
  })
})
