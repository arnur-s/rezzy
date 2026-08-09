import type { Tables } from '@/api/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkspace, getUserWorkspaces } from './workspaces'

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/utils/supabase', () => ({
  supabase: supabaseMock,
}))

const memberWorkspace = {
  created_at: '2026-05-20T08:00:00.000Z',
  created_by: 'owner-1',
  default_phone_region: null,
  deleted_at: null,
  description: 'Shared sales workspace',
  icon: 'briefcase',
  id: 'workspace-1',
  is_main: false,
  name: 'Sales',
  updated_at: '2026-05-20T08:00:00.000Z',
  updated_by: null,
} satisfies Tables<'workspaces'>

describe('workspace API', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset()
    supabaseMock.rpc.mockReset()
  })

  it('returns every workspace allowed by membership RLS', async () => {
    const secondOrder = vi.fn().mockResolvedValue({
      data: [memberWorkspace],
      error: null,
    })
    const firstOrder = vi.fn().mockReturnValue({ order: secondOrder })
    const select = vi.fn().mockReturnValue({ order: firstOrder })

    supabaseMock.from.mockReturnValue({ select })

    await expect(getUserWorkspaces()).resolves.toEqual([memberWorkspace])
    expect(supabaseMock.from).toHaveBeenCalledWith('workspaces')
    expect(select).toHaveBeenCalledWith('*')
    expect(firstOrder).toHaveBeenCalledWith('is_main', { ascending: false })
    expect(secondOrder).toHaveBeenCalledWith('created_at', {
      ascending: true,
    })
  })

  it('creates the workspace through the create_workspace RPC, leaving owner membership to the database trigger', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: memberWorkspace,
      error: null,
    })

    await expect(
      createWorkspace({
        description: ' Shared sales workspace ',
        icon: 'briefcase',
        isMain: false,
        name: ' Sales ',
        userId: 'owner-1',
      }),
    ).resolves.toEqual(memberWorkspace)

    expect(supabaseMock.from).not.toHaveBeenCalled()
    expect(supabaseMock.rpc).toHaveBeenCalledOnce()
    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_workspace', {
      p_name: 'Sales',
      p_description: 'Shared sales workspace',
      p_icon: 'briefcase',
      p_is_main: false,
    })
  })
})
