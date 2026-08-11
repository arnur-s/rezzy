import { workspaceQueryKeys } from '@/features/workspaces/api/workspaces'
import { useRemoveMember } from '@/features/workspaces/hooks/use-workspace-membership'
import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `remove_workspace_member` doubles as "leave": the RPC lets anyone remove
 * themselves. That makes one mutation change two different things depending on
 * whose row it is, and only the self case touches the caller's own workspace
 * list.
 *
 * `useWorkspaces` carries no `staleTime` and `refetchOnWindowFocus: false`, so
 * nothing else would ever refetch it — a workspace the user just left would sit
 * in the switcher until a hard reload, pointing at content RLS has already
 * withdrawn. These assertions are what stands between that and the fix.
 */

const membershipApi = vi.hoisted(() => ({ removeMember: vi.fn() }))

vi.mock('@/features/workspaces/api/workspace-membership', () => ({
  removeMember: membershipApi.removeMember,
  inviteWorkspaceMember: vi.fn(),
  listMyInvitations: vi.fn(),
  listWorkspaceInvitations: vi.fn(),
  respondToInvitation: vi.fn(),
  revokeWorkspaceInvitation: vi.fn(),
  updateMemberRole: vi.fn(),
}))

const CURRENT_USER_ID = 'u1'
const OTHER_USER_ID = 'u2'
const WORKSPACE_ID = 'w1'

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: CURRENT_USER_ID } }),
}))

const ROSTER_KEY = workspaceQueryKeys.memberDirectory(WORKSPACE_ID)
const OWN_LIST_KEY = workspaceQueryKeys.list(CURRENT_USER_ID)
const DETAIL_KEY = workspaceQueryKeys.detail(WORKSPACE_ID)

function seed(queryClient: QueryClient, keys: Array<QueryKey>) {
  for (const key of keys) {
    queryClient.setQueryData(key, { seeded: true })
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false)
  }
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('useRemoveMember', () => {
  beforeEach(() => {
    membershipApi.removeMember.mockReset()
    membershipApi.removeMember.mockResolvedValue(undefined)
  })

  it('marks the switcher and the workspace stale when the caller leaves', async () => {
    const queryClient = createTestQueryClient()
    seed(queryClient, [ROSTER_KEY, OWN_LIST_KEY, DETAIL_KEY])

    const { result } = renderHook(() => useRemoveMember(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({ userId: CURRENT_USER_ID })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    for (const key of [ROSTER_KEY, OWN_LIST_KEY, DETAIL_KEY]) {
      expect(
        queryClient.getQueryState(key)?.isInvalidated,
        JSON.stringify(key),
      ).toBe(true)
    }
  })

  it('leaves the caller’s own workspace list alone when removing somebody else', async () => {
    const queryClient = createTestQueryClient()
    seed(queryClient, [ROSTER_KEY, OWN_LIST_KEY])

    const { result } = renderHook(() => useRemoveMember(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({ userId: OTHER_USER_ID })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // The roster changed for everyone; the acting admin's own membership set
    // did not, so refetching their workspace list would be a wasted request.
    expect(queryClient.getQueryState(ROSTER_KEY)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(OWN_LIST_KEY)?.isInvalidated).toBe(false)
  })
})
