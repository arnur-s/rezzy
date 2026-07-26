import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingSessionExpiredError, completeOnboarding } from './onboarding'

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('@/utils/supabase', () => ({
  supabase: supabaseMock,
}))

describe('completeOnboarding', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset()
  })

  it('sends trimmed names and no user id, and unwraps the created workspace', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{ is_new: true, workspace_id: 'workspace-1' }],
      error: null,
    })

    await expect(
      completeOnboarding({
        fullName: '  Ada Lovelace  ',
        workspaceName: '  Acme Sales  ',
      }),
    ).resolves.toEqual({ isNew: true, workspaceId: 'workspace-1' })

    expect(supabaseMock.rpc).toHaveBeenCalledWith('complete_onboarding', {
      p_full_name: 'Ada Lovelace',
      p_workspace_name: 'Acme Sales',
    })
  })

  it('reports the existing workspace when onboarding already completed', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{ is_new: false, workspace_id: 'workspace-1' }],
      error: null,
    })

    await expect(
      completeOnboarding({ fullName: 'Ada', workspaceName: 'Acme' }),
    ).resolves.toEqual({ isNew: false, workspaceId: 'workspace-1' })
  })

  it('raises a typed error when the session expired', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: {
        code: '28000',
        message: 'complete_onboarding requires an authenticated user',
      },
    })

    await expect(
      completeOnboarding({ fullName: 'Ada', workspaceName: 'Acme' }),
    ).rejects.toBeInstanceOf(OnboardingSessionExpiredError)
  })

  it('passes any other database error through untouched', async () => {
    const error = { code: '22023', message: 'workspace name is too short' }
    supabaseMock.rpc.mockResolvedValue({ data: null, error })

    await expect(
      completeOnboarding({ fullName: 'Ada', workspaceName: 'A' }),
    ).rejects.toBe(error)
  })

  it('fails loudly when the RPC returns no row', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null })

    await expect(
      completeOnboarding({ fullName: 'Ada', workspaceName: 'Acme' }),
    ).rejects.toThrow('complete_onboarding returned no workspace.')
  })
})
