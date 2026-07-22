import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inboxQueryKeys } from '../api/query-keys'
import { useMarkConversationReadToMessage } from './use-messages'

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('@/utils/supabase', () => ({
  supabase: supabaseMock,
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('useMarkConversationReadToMessage', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset()
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null })
  })

  it('clears the per-agent unread-counts map entry for the conversation', async () => {
    const workspaceId = 'w1'
    const userId = 'u1'
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })

    // The conversation-list badge is driven by this per-agent map, so marking a
    // thread read must clear its entry (not just conversations.unread_count).
    queryClient.setQueryData<Record<string, number>>(
      inboxQueryKeys.unreadCounts(workspaceId, userId),
      { c1: 1, c2: 3 },
    )

    const { result } = renderHook(
      () => useMarkConversationReadToMessage({ workspaceId, userId }),
      { wrapper: createWrapper(queryClient) },
    )

    result.current.mutate({ conversationId: 'c1', lastReadMessageId: 'm9' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(
      queryClient.getQueryData<Record<string, number>>(
        inboxQueryKeys.unreadCounts(workspaceId, userId),
      ),
    ).toEqual({ c1: 0, c2: 3 })
  })
})
