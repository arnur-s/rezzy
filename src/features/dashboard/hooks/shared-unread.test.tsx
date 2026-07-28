import { useAttentionQueue } from '@/features/dashboard/hooks/use-attention-queue'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { useHomeStats } from '@/features/dashboard/hooks/use-home-stats'
import { createTestQueryClient } from '@/test/render'
import { mockQueryBuilder } from '@/test/supabase-query-mock'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Home mounts three queries that each need the same per-agent unread map. This
 * pins that a home load costs one `get_unread_counts_for_workspaces` call, not
 * three, since the waste is invisible from the UI and easy to reintroduce by
 * calling the API function directly from a new hook.
 */

const supabaseMock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/utils/supabase', () => ({ supabase: supabaseMock }))

const WORKSPACE_IDS = ['w1']

function wrapper(client: ReturnType<typeof createTestQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('home shares one unread fetch across its queries', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset()
    supabaseMock.rpc.mockReset()
    supabaseMock.from.mockImplementation(() => mockQueryBuilder([]))
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null })
  })

  it('calls the unread RPC once for all three home queries', async () => {
    const queryClient = createTestQueryClient()
    const Wrapper = wrapper(queryClient)

    const { result } = renderHook(
      () => ({
        home: useHomeStats('u1', WORKSPACE_IDS),
        attention: useAttentionQueue('u1', WORKSPACE_IDS),
        stats: useDashboardStats(WORKSPACE_IDS),
      }),
      { wrapper: Wrapper },
    )

    await waitFor(() => {
      expect(result.current.home.isSuccess).toBe(true)
      expect(result.current.attention.isSuccess).toBe(true)
      expect(result.current.stats.isSuccess).toBe(true)
    })

    const unreadCalls = supabaseMock.rpc.mock.calls.filter(
      ([name]) => name === 'get_unread_counts_for_workspaces',
    )
    expect(unreadCalls).toHaveLength(1)
  })
})
