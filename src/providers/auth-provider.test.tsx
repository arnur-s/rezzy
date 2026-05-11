import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './auth-provider'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

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

const session = {
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
} as Session

function AuthProbe() {
  const auth = useAuth()

  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="email">{auth.user?.email ?? 'none'}</span>
      <button onClick={() => void auth.signOut()} type="button">
        Sign out
      </button>
    </div>
  )
}

function renderProvider(children: ReactNode) {
  return render(<AuthProvider>{children}</AuthProvider>)
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
