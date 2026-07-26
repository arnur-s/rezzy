import { initLocale } from '@/lib/locale'
import { cookieName } from '@/paraglide/runtime'
import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accountQueryKeys } from '../api/query-keys'
import type { UserProfile } from '../model/types'
import {
  useLanguagePreference,
  useSyncLanguagePreference,
} from './use-language-preference'

const USER_ID = 'user-1'

const hoisted = vi.hoisted(() => ({
  updateMyLanguage: vi.fn(),
  showToast: vi.fn(),
  reload: vi.fn(),
}))

vi.mock('../api/profile', () => ({
  updateMyLanguage: hoisted.updateMyLanguage,
  getMyProfile: vi.fn(),
  getMyWorkspaceMemberships: vi.fn(),
  updateMyProfileIdentity: vi.fn(),
  updateMyAvatarUrl: vi.fn(),
}))

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: USER_ID, email: 'agent@example.com', user_metadata: {} },
    session: null,
    isLoading: false,
    signOut: vi.fn(),
  }),
}))

vi.mock('@astryxdesign/core/Toast', () => ({
  useToast: () => hoisted.showToast,
}))

function profile(language: UserProfile['language']): UserProfile {
  return {
    id: USER_ID,
    fullName: 'Ada Lovelace',
    email: 'agent@example.com',
    avatarUrl: null,
    jobTitle: null,
    phone: null,
    timezone: null,
    language,
  }
}

function readCookiePreference() {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`),
  )
  const value = match?.[1] ?? ''
  return value.length > 0 ? value : 'auto'
}

function setCookie(value: string | null) {
  document.cookie = value
    ? `${cookieName}=${value}; path=/`
    : `${cookieName}=; path=/; max-age=0`
}

function setBrowserLanguages(languages: Array<string>) {
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    get: () => languages,
  })
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

/** Exposes the hook's state and a way to drive it from a test. */
function LanguageProbe() {
  const language = useLanguagePreference()

  return (
    <div>
      <span data-testid="preference">{language.preference}</span>
      <span data-testid="pending">{String(language.isPending)}</span>
      <button type="button" onClick={() => language.select('ru')}>
        pick ru
      </button>
      <button type="button" onClick={() => language.select('auto')}>
        pick auto
      </button>
    </div>
  )
}

function SyncProbe() {
  useSyncLanguagePreference()
  return null
}

describe('useLanguagePreference', () => {
  beforeEach(() => {
    setCookie(null)
    setBrowserLanguages(['en-US'])
    // main.tsx pins the boot locale before React mounts; without it the memo
    // would latch onto whatever a previous test left behind.
    initLocale()
    hoisted.updateMyLanguage.mockReset()
    hoisted.showToast.mockReset()
    hoisted.reload.mockReset()

    // jsdom's location.reload is not implemented; the hook only ever calls it.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: hoisted.reload },
    })
  })

  it('shows the server preference once the profile resolves', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(accountQueryKeys.profile(USER_ID), profile('ru'))

    render(<LanguageProbe />, { wrapper: wrapper(queryClient) })

    await waitFor(() =>
      expect(screen.getByTestId('preference').textContent).toBe('ru'),
    )
  })

  it('updates the control, the cache, and the query optimistically', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(accountQueryKeys.profile(USER_ID), profile('auto'))

    // Never resolves: this asserts the state during the write, not after it.
    hoisted.updateMyLanguage.mockReturnValue(new Promise(() => {}))

    render(<LanguageProbe />, { wrapper: wrapper(queryClient) })

    fireEvent.click(screen.getByText('pick ru'))

    await waitFor(() =>
      expect(screen.getByTestId('preference').textContent).toBe('ru'),
    )
    expect(readCookiePreference()).toBe('ru')
    expect(
      queryClient.getQueryData<UserProfile>(accountQueryKeys.profile(USER_ID))
        ?.language,
    ).toBe('ru')
    // Not reloaded yet — the write is still in flight.
    expect(hoisted.reload).not.toHaveBeenCalled()
  })

  it('reloads only after the write succeeds', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(accountQueryKeys.profile(USER_ID), profile('auto'))
    hoisted.updateMyLanguage.mockResolvedValue(profile('ru'))

    render(<LanguageProbe />, { wrapper: wrapper(queryClient) })

    fireEvent.click(screen.getByText('pick ru'))

    await waitFor(() => expect(hoisted.reload).toHaveBeenCalledTimes(1))
    expect(hoisted.updateMyLanguage).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, language: 'ru' }),
    )
  })

  it('rolls back the control, the cache, and the query when the write fails', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(accountQueryKeys.profile(USER_ID), profile('auto'))
    hoisted.updateMyLanguage.mockRejectedValue(new Error('offline'))

    render(<LanguageProbe />, { wrapper: wrapper(queryClient) })

    fireEvent.click(screen.getByText('pick ru'))

    await waitFor(() =>
      expect(screen.getByTestId('preference').textContent).toBe('auto'),
    )
    expect(readCookiePreference()).toBe('auto')
    expect(
      queryClient.getQueryData<UserProfile>(accountQueryKeys.profile(USER_ID))
        ?.language,
    ).toBe('auto')
    expect(hoisted.reload).not.toHaveBeenCalled()
    expect(hoisted.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    )
  })

  it('does not reload when the choice renders the same language', async () => {
    setCookie(null)
    setBrowserLanguages(['ru-RU'])
    initLocale()
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(accountQueryKeys.profile(USER_ID), profile('en'))
    hoisted.updateMyLanguage.mockResolvedValue(profile('auto'))

    render(<LanguageProbe />, { wrapper: wrapper(queryClient) })

    fireEvent.click(screen.getByText('pick auto'))

    await waitFor(() =>
      expect(hoisted.updateMyLanguage).toHaveBeenCalledTimes(1),
    )
    // The page booted with no cookie and a Russian browser, so 'auto' is
    // already what is on screen.
    expect(hoisted.reload).not.toHaveBeenCalled()
  })
})

describe('useSyncLanguagePreference', () => {
  beforeEach(() => {
    setCookie(null)
    setBrowserLanguages(['en-US'])
    initLocale()
    hoisted.reload.mockReset()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: hoisted.reload },
    })
  })

  it('adopts the server preference and reloads when it changes the language', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(accountQueryKeys.profile(USER_ID), profile('ru'))

    render(<SyncProbe />, { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(readCookiePreference()).toBe('ru'))
    expect(hoisted.reload).toHaveBeenCalledTimes(1)
  })

  it('updates the cache without reloading when the language is unchanged', async () => {
    setCookie('ru')
    setBrowserLanguages(['ru-RU'])
    initLocale()
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(accountQueryKeys.profile(USER_ID), profile('auto'))

    render(<SyncProbe />, { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(readCookiePreference()).toBe('auto'))
    expect(hoisted.reload).not.toHaveBeenCalled()
  })

  it('leaves the cache alone when the server already agrees', async () => {
    setCookie('en')
    initLocale()
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(accountQueryKeys.profile(USER_ID), profile('en'))

    render(<SyncProbe />, { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(readCookiePreference()).toBe('en'))
    expect(hoisted.reload).not.toHaveBeenCalled()
  })
})
