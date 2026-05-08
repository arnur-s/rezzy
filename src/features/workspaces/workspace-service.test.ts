import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceWithUniqueSlug } from './workspace-service'
import type { WorkspaceClient } from './workspace-service'

function createWorkspaceClientMock(
  results: Array<{
    data: { id: string; slug: string } | null
    error: { code?: string; message: string } | null
  }>,
) {
  const single = vi
    .fn()
    .mockImplementation(() => Promise.resolve(results.shift()))
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  const from = vi.fn(() => ({ insert }))

  return {
    client: { from } as unknown as WorkspaceClient,
    from,
    insert,
    select,
    single,
  }
}

describe('createWorkspaceWithUniqueSlug', () => {
  it('creates a workspace with the normalized base slug', async () => {
    const workspaceClient = createWorkspaceClientMock([
      {
        data: { id: 'workspace-1', slug: 'acme-operations' },
        error: null,
      },
    ])

    await expect(
      createWorkspaceWithUniqueSlug(
        'Acme Operations',
        'user-1',
        workspaceClient.client,
      ),
    ).resolves.toEqual({ id: 'workspace-1', slug: 'acme-operations' })

    expect(workspaceClient.from).toHaveBeenCalledWith('workspaces')
    expect(workspaceClient.insert).toHaveBeenCalledWith({
      created_by: 'user-1',
      name: 'Acme Operations',
      slug: 'acme-operations',
    })
  })

  it('retries unique slug collisions with a numeric suffix', async () => {
    const workspaceClient = createWorkspaceClientMock([
      {
        data: null,
        error: { code: '23505', message: 'duplicate slug' },
      },
      {
        data: { id: 'workspace-2', slug: 'acme-operations-2' },
        error: null,
      },
    ])

    await expect(
      createWorkspaceWithUniqueSlug(
        'Acme Operations',
        'user-1',
        workspaceClient.client,
      ),
    ).resolves.toEqual({ id: 'workspace-2', slug: 'acme-operations-2' })

    expect(workspaceClient.insert).toHaveBeenNthCalledWith(1, {
      created_by: 'user-1',
      name: 'Acme Operations',
      slug: 'acme-operations',
    })
    expect(workspaceClient.insert).toHaveBeenNthCalledWith(2, {
      created_by: 'user-1',
      name: 'Acme Operations',
      slug: 'acme-operations-2',
    })
  })

  it('does not retry non-unique database errors', async () => {
    const workspaceClient = createWorkspaceClientMock([
      {
        data: null,
        error: { code: '42501', message: 'permission denied' },
      },
    ])

    await expect(
      createWorkspaceWithUniqueSlug(
        'Acme Operations',
        'user-1',
        workspaceClient.client,
      ),
    ).rejects.toEqual({ code: '42501', message: 'permission denied' })

    expect(workspaceClient.insert).toHaveBeenCalledTimes(1)
  })
})
