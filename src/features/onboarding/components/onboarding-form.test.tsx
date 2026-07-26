import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingForm } from './onboarding-form'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return { ...actual, useNavigate: () => navigateMock }
})

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/utils/supabase', () => ({ supabase: supabaseMock }))

const workspaceNameField = /Workspace name/

function fillIn(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: workspaceNameField }), {
    target: { value },
  })
}

function submitButton() {
  return screen.getByRole('button', { name: /Create workspace|Creating/ })
}

function submit() {
  fireEvent.click(submitButton())
}

describe('OnboardingForm', () => {
  // The project's base locale is ru; these assertions read the English copy.
  beforeAll(() => {
    setLocale('en')
  })

  beforeEach(() => {
    navigateMock.mockReset()
    supabaseMock.rpc.mockReset()
    supabaseMock.rpc.mockResolvedValue({
      data: [{ is_new: true, workspace_id: 'workspace-1' }],
      error: null,
    })
  })

  it('asks only for the workspace name', () => {
    renderWithQueryClient(<OnboardingForm />)

    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.queryByLabelText(/Full name/)).toBeNull()
  })

  it('focuses the workspace name field on arrival', () => {
    renderWithQueryClient(<OnboardingForm />)

    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: workspaceNameField }),
    )
  })

  it('requires a workspace name before it will call the database', async () => {
    renderWithQueryClient(<OnboardingForm />)

    submit()

    expect(
      await screen.findByText('Workspace name must be at least 2 characters'),
    ).toBeTruthy()
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only workspace name', async () => {
    renderWithQueryClient(<OnboardingForm />)

    fillIn('   ')
    submit()

    expect(
      await screen.findByText('Workspace name must be at least 2 characters'),
    ).toBeTruthy()
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it('trims the workspace name and sends nothing else', async () => {
    renderWithQueryClient(<OnboardingForm />)

    fillIn('  Acme Sales  ')
    submit()

    await waitFor(() => {
      expect(supabaseMock.rpc).toHaveBeenCalledWith('complete_onboarding', {
        p_workspace_name: 'Acme Sales',
      })
    })
  })

  it('submits on Enter', async () => {
    renderWithQueryClient(<OnboardingForm />)

    fillIn('Acme Sales')
    fireEvent.submit(screen.getByRole('textbox', { name: workspaceNameField }))

    await waitFor(() => {
      expect(supabaseMock.rpc).toHaveBeenCalledOnce()
    })
  })

  // Channel setup happens in settings, so a brand-new workspace lands there
  // rather than in an inbox that cannot receive anything yet.
  it('sends the new workspace to its channel settings', async () => {
    renderWithQueryClient(<OnboardingForm />)

    fillIn('Acme Sales')
    submit()

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/workspaces/$id/settings/channels',
        params: { id: 'workspace-1' },
      })
    })
  })

  // A repeat submission returns the workspace that already exists, so a user who
  // refreshed mid-request still lands somewhere correct.
  it('follows an already-created workspace to its channel settings', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{ is_new: false, workspace_id: 'workspace-existing' }],
      error: null,
    })

    renderWithQueryClient(<OnboardingForm />)

    fillIn('Acme Sales')
    submit()

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/workspaces/$id/settings/channels',
        params: { id: 'workspace-existing' },
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

    fillIn('Acme Sales')
    submit()

    await waitFor(() => {
      expect(submitButton().hasAttribute('disabled')).toBe(true)
    })
    expect(
      screen
        .getByRole('textbox', { name: workspaceNameField })
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

  it('announces the work in progress while pending', async () => {
    let resolveRpc: (value: unknown) => void = () => {}
    supabaseMock.rpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )

    renderWithQueryClient(<OnboardingForm />)

    fillIn('Acme Sales')
    submit()

    expect(
      await screen.findByRole('button', { name: /Creating workspace/ }),
    ).toBeTruthy()

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

    fillIn('Acme Sales')
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

  it('keeps the entered value and offers a retry when the setup fails', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { code: '08006', message: 'connection failure' },
    })

    renderWithQueryClient(<OnboardingForm />)

    fillIn('Acme Sales')
    submit()

    expect(await screen.findByText('Could not create workspace')).toBeTruthy()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(
      screen.getByRole('textbox', { name: workspaceNameField }),
    ).toHaveProperty('value', 'Acme Sales')

    // The failed transaction created nothing, so submitting again is a retry.
    supabaseMock.rpc.mockResolvedValue({
      data: [{ is_new: true, workspace_id: 'workspace-2' }],
      error: null,
    })
    submit()

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/workspaces/$id/settings/channels',
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

    fillIn('Acme Sales')
    submit()

    expect(
      await screen.findByText(
        'Your session expired. Sign in again to finish setup.',
      ),
    ).toBeTruthy()
  })
})
