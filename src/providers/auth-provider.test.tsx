import type { Session } from '@supabase/supabase-js'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createTestQueryClient, renderWithQueryClient } from '@/test/render'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './auth-provider'

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
  },
}))

vi.mock('@/utils/supabase', () => ({
  supabase: supabaseMock,
}))

const session: Session = {
  access_token: 'access-token',
  expires_at: 1_900_000_000,
  expires_in: 3600,
  refresh_token: 'refresh-token',
  token_type: 'bearer',
  user: {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-05-08T00:00:00.000Z',
    email: 'alex@example.com',
    id: 'user-1',
    user_metadata: {},
  },
}

function AuthProbe() {
  const auth = useAuth()

  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="email">{auth.user?.email ?? 'none'}</span>
      <button onClick={() => void auth.signOut()} type="button">
        Sign out
      </button>
      <button onClick={() => void auth.signOut('others')} type="button">
        Sign out other devices
      </button>
    </div>
  )
}

function renderProvider(children: ReactNode) {
  return renderWithQueryClient(<AuthProvider>{children}</AuthProvider>)
}

function emitSession(nextSession: Session | null) {
  act(() => {
    supabaseMock.auth.onAuthStateChange.mock.calls.at(-1)?.[0](
      nextSession ? 'SIGNED_IN' : 'SIGNED_OUT',
      nextSession,
    )
  })
}

describe('AuthProvider', () => {
  beforeEach(() => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    })
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    })
    supabaseMock.auth.signOut.mockResolvedValue({ error: null })
  })

  it('loads the current session and exposes the user', async () => {
    renderProvider(<AuthProbe />)

    expect(screen.getByTestId('loading').textContent).toBe('true')

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    expect(screen.getByTestId('email').textContent).toBe('alex@example.com')
  })

  it('clears the current session after sign out', async () => {
    renderProvider(<AuthProbe />)

    await waitFor(() => {
      expect(screen.getByTestId('email').textContent).toBe('alex@example.com')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(screen.getByTestId('email').textContent).toBe('none')
    })
    expect(supabaseMock.auth.signOut).toHaveBeenCalledOnce()
  })

  it('unsubscribes from auth changes on unmount', () => {
    const unsubscribe = vi.fn()
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe,
        },
      },
    })

    const view = renderProvider(<AuthProbe />)

    view.unmount()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('does not resurrect a session when the initial read finishes after sign out', async () => {
    let finishRead!: (value: {
      data: { session: Session }
      error: null
    }) => void
    supabaseMock.auth.getSession.mockReturnValue(
      new Promise((resolve) => {
        finishRead = resolve
      }),
    )
    renderProvider(<AuthProbe />)

    emitSession(null)
    await act(async () => {
      finishRead({ data: { session }, error: null })
      await Promise.resolve()
    })

    expect(screen.getByTestId('email').textContent).toBe('none')
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('finishes loading when the initial session read rejects', async () => {
    supabaseMock.auth.getSession.mockRejectedValue(
      new Error('Storage unavailable'),
    )
    renderProvider(<AuthProbe />)

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('email').textContent).toBe('none')
  })

  it('clears private cached data on a cross-tab identity change and cancels old reads', async () => {
    const queryClient = createTestQueryClient()
    renderWithQueryClient(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
      { queryClient },
    )
    await waitFor(() =>
      expect(screen.getByTestId('email').textContent).toBe('alex@example.com'),
    )
    queryClient.setQueryData(['inbox', 'contact', 'contact-1'], {
      name: 'Private customer',
    })
    let finishRead!: (value: string) => void
    const pending = queryClient
      .fetchQuery({
        queryKey: ['inbox', 'messages', 'conversation-1'],
        queryFn: () =>
          new Promise<string>((resolve) => {
            finishRead = resolve
          }),
      })
      .catch(() => undefined)

    emitSession({
      ...session,
      user: { ...session.user, id: 'user-2', email: 'other@example.com' },
    })
    await act(async () => {
      finishRead('Private message')
      await pending
    })

    expect(screen.getByTestId('email').textContent).toBe('other@example.com')
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('preserves the cache for token refresh and signing out other devices', async () => {
    const { queryClient } = renderProvider(<AuthProbe />)
    await waitFor(() =>
      expect(screen.getByTestId('email').textContent).toBe('alex@example.com'),
    )
    queryClient.setQueryData(
      ['inbox', 'messages', 'conversation-1'],
      ['message'],
    )

    emitSession({ ...session, access_token: 'refreshed-token' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign out other devices' }),
    )
    await waitFor(() =>
      expect(supabaseMock.auth.signOut).toHaveBeenCalledWith({
        scope: 'others',
      }),
    )

    expect(screen.getByTestId('email').textContent).toBe('alex@example.com')
    expect(
      queryClient.getQueryData(['inbox', 'messages', 'conversation-1']),
    ).toEqual(['message'])
  })

  it('clears the cache when signing out locally even without an auth callback', async () => {
    const { queryClient } = renderProvider(<AuthProbe />)
    await waitFor(() =>
      expect(screen.getByTestId('email').textContent).toBe('alex@example.com'),
    )
    queryClient.setQueryData(
      ['inbox', 'messages', 'conversation-1'],
      ['message'],
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() =>
      expect(screen.getByTestId('email').textContent).toBe('none'),
    )
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('does not clear a newer account when an older sign-out finishes', async () => {
    let finishSignOut!: (value: { error: null }) => void
    supabaseMock.auth.signOut.mockReturnValue(
      new Promise((resolve) => {
        finishSignOut = resolve
      }),
    )
    const { queryClient } = renderProvider(<AuthProbe />)
    await waitFor(() =>
      expect(screen.getByTestId('email').textContent).toBe('alex@example.com'),
    )
    fireEvent.click(screen.getByRole('button', { name: /^Sign out$/ }))
    emitSession({
      ...session,
      user: { ...session.user, id: 'user-2', email: 'other@example.com' },
    })
    queryClient.setQueryData(['new-account-data'], 'current')
    await act(async () => {
      finishSignOut({ error: null })
      await Promise.resolve()
    })
    expect(screen.getByTestId('email').textContent).toBe('other@example.com')
    expect(queryClient.getQueryData(['new-account-data'])).toBe('current')
  })

  it('requires the provider', () => {
    function MissingProviderProbe() {
      useAuth()
      return null
    }

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    expect(() => render(<MissingProviderProbe />)).toThrow(
      'useAuth must be used inside AuthProvider',
    )

    consoleError.mockRestore()
  })
})
