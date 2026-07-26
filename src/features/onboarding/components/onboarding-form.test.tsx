import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import type { User } from '@supabase/supabase-js'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingForm } from './onboarding-form'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return { ...actual, useNavigate: () => navigateMock }
})

const supabaseMock = vi.hoisted(() => ({
  auth: {
    updateUser: vi.fn(),
  },
  rpc: vi.fn(),
}))

vi.mock('@/utils/supabase', () => ({
  supabase: supabaseMock,
}))

const authMock = vi.hoisted(() => ({ user: null as User | null }))

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => authMock,
}))

function fillIn(name: RegExp, value: string) {
  fireEvent.change(screen.getByRole('textbox', { name }), {
    target: { value },
  })
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Continue to inbox' }))
}

const fullNameField = /Full name/
const workspaceNameField = /Workspace name/

describe('OnboardingForm', () => {
  // The project's base locale is ru; these assertions read the English copy.
  beforeAll(() => {
    setLocale('en')
  })

  beforeEach(() => {
    authMock.user = null
    navigateMock.mockReset()
    supabaseMock.rpc.mockReset()
    supabaseMock.auth.updateUser.mockReset()
    supabaseMock.auth.updateUser.mockResolvedValue({ error: null })
    supabaseMock.rpc.mockResolvedValue({
      data: [{ is_new: true, workspace_id: 'workspace-1' }],
      error: null,
    })
  })

  it('requires both fields before it will call the database', async () => {
    renderWithQueryClient(<OnboardingForm />)

    submit()

    expect(await screen.findByText('Enter your full name')).toBeTruthy()
    expect(
      screen.getByText('Workspace name must be at least 2 characters'),
    ).toBeTruthy()
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it('rejects whitespace-only names', async () => {
    renderWithQueryClient(<OnboardingForm />)

    fillIn(fullNameField, '   ')
    fillIn(workspaceNameField, '   ')
    submit()

    expect(await screen.findByText('Enter your full name')).toBeTruthy()
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it('trims the submitted values and sends no user id', async () => {
    renderWithQueryClient(<OnboardingForm />)

    fillIn(fullNameField, '  Ada Lovelace  ')
    fillIn(workspaceNameField, '  Acme Sales  ')
    submit()

    await waitFor(() => {
      expect(supabaseMock.rpc).toHaveBeenCalledWith('complete_onboarding', {
        p_full_name: 'Ada Lovelace',
        p_workspace_name: 'Acme Sales',
      })
    })
  })

  it('navigates to the new workspace inbox after a successful setup', async () => {
    renderWithQueryClient(<OnboardingForm />)

    fillIn(fullNameField, 'Ada Lovelace')
    fillIn(workspaceNameField, 'Acme Sales')
    submit()

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/workspaces/$id/inbox',
        params: { id: 'workspace-1' },
      })
    })
  })

  it('disables the form while the setup is in flight', async () => {
    let resolveRpc: (value: unknown) => void = () => {}
    supabaseMock.rpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )

    renderWithQueryClient(<OnboardingForm />)

    fillIn(fullNameField, 'Ada Lovelace')
    fillIn(workspaceNameField, 'Acme Sales')
    submit()

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: 'Continue to inbox' })
          .hasAttribute('disabled'),
      ).toBe(true)
    })
    expect(
      screen
        .getByRole('textbox', { name: fullNameField })
        .hasAttribute('disabled'),
    ).toBe(true)

    resolveRpc({
      data: [{ is_new: true, workspace_id: 'workspace-1' }],
      error: null,
    })
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalled()
    })
  })

  it('runs the setup once when the button is clicked repeatedly', async () => {
    let resolveRpc: (value: unknown) => void = () => {}
    supabaseMock.rpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )

    renderWithQueryClient(<OnboardingForm />)

    fillIn(fullNameField, 'Ada Lovelace')
    fillIn(workspaceNameField, 'Acme Sales')
    submit()

    await waitFor(() => {
      expect(supabaseMock.rpc).toHaveBeenCalledTimes(1)
    })

    submit()
    submit()

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1)

    resolveRpc({
      data: [{ is_new: true, workspace_id: 'workspace-1' }],
      error: null,
    })
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledOnce()
    })
  })

  it('keeps the entered values and offers a retry when the setup fails', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { code: '08006', message: 'connection failure' },
    })

    renderWithQueryClient(<OnboardingForm />)

    fillIn(fullNameField, 'Ada Lovelace')
    fillIn(workspaceNameField, 'Acme Sales')
    submit()

    expect(await screen.findByText('Could not finish setup')).toBeTruthy()
    expect(navigateMock).not.toHaveBeenCalled()

    const fullName = screen.getByRole('textbox', { name: fullNameField })
    const workspaceName = screen.getByRole('textbox', {
      name: workspaceNameField,
    })
    expect(fullName).toHaveProperty('value', 'Ada Lovelace')
    expect(workspaceName).toHaveProperty('value', 'Acme Sales')

    // The failed transaction created nothing, so submitting again is a retry.
    supabaseMock.rpc.mockResolvedValue({
      data: [{ is_new: true, workspace_id: 'workspace-2' }],
      error: null,
    })
    submit()

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/workspaces/$id/inbox',
        params: { id: 'workspace-2' },
      })
    })
  })

  it('explains an expired session instead of a generic failure', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: {
        code: '28000',
        message: 'complete_onboarding requires an authenticated user',
      },
    })

    renderWithQueryClient(<OnboardingForm />)

    fillIn(fullNameField, 'Ada Lovelace')
    fillIn(workspaceNameField, 'Acme Sales')
    submit()

    expect(
      await screen.findByText(
        'Your session expired. Sign in again to finish setup.',
      ),
    ).toBeTruthy()
  })

  it('prefills the name captured at sign-up', () => {
    authMock.user = {
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-07-26T00:00:00.000Z',
      id: 'user-1',
      user_metadata: { full_name: 'Ada Lovelace' },
    }

    renderWithQueryClient(<OnboardingForm />)

    expect(
      screen.getByRole('textbox', { name: fullNameField }),
    ).toHaveProperty('value', 'Ada Lovelace')
  })

  it('still completes setup when the auth metadata sync fails', async () => {
    supabaseMock.auth.updateUser.mockResolvedValue({
      error: { message: 'metadata update failed' },
    })
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    renderWithQueryClient(<OnboardingForm />)

    fillIn(fullNameField, 'Ada Lovelace')
    fillIn(workspaceNameField, 'Acme Sales')
    submit()

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/workspaces/$id/inbox',
        params: { id: 'workspace-1' },
      })
    })

    consoleError.mockRestore()
  })
})
