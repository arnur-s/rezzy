import { attentionQueueQueryKeys } from '@/features/dashboard/api/attention-queue'
import { dashboardQueryKeys } from '@/features/dashboard/api/dashboard-stats'
import { homeStatsQueryKeys } from '@/features/dashboard/api/home-stats'
import {
  useMarkConversationRead,
  useUpdateConversationStatus,
} from '@/features/inbox/hooks/use-conversations'
import { useSendMessage } from '@/features/inbox/hooks/use-messages'
import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Home reads conversation state that the inbox mutates, and the two live in
 * separate caches. These tests pin the contract that inbox work marks home
 * stale, because the failure it prevents is silent: home simply serves the
 * pre-mutation numbers on the next visit and contradicts the inbox the user
 * just cleared.
 */

const conversationsApi = vi.hoisted(() => ({
  markConversationRead: vi.fn(),
  updateConversationStatus: vi.fn(),
}))
const messagesApi = vi.hoisted(() => ({ sendOutboundMessage: vi.fn() }))

vi.mock('@/features/inbox/api/conversations', () => ({
  getWorkspaceConversations: vi.fn(),
  getWorkspaceConversationsBySearch: vi.fn(),
  markConversationRead: conversationsApi.markConversationRead,
  updateConversationStatus: conversationsApi.updateConversationStatus,
}))

vi.mock('@/features/inbox/api/messages', () => ({
  getConversationMessagesPage: vi.fn(),
  retryOutboundMessage: vi.fn(),
  sendOutboundMessage: messagesApi.sendOutboundMessage,
}))

const WORKSPACE_ID = 'w1'
const CONVERSATION_ID = 'c1'

/** Every home query, so a partial invalidation cannot pass this suite. */
const HOME_KEYS: Array<QueryKey> = [
  dashboardQueryKeys.stats([WORKSPACE_ID]),
  homeStatsQueryKeys.forUser('u1', [WORKSPACE_ID]),
  attentionQueueQueryKeys.forUser('u1', [WORKSPACE_ID]),
  attentionQueueQueryKeys.unassigned([WORKSPACE_ID]),
]

/** Seeds each home query as fresh, so invalidation is the only thing that can flip it. */
function seedHomeQueries(queryClient: QueryClient) {
  for (const key of HOME_KEYS) {
    queryClient.setQueryData(key, { seeded: true })
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false)
  }
}

function expectHomeInvalidated(queryClient: QueryClient) {
  for (const key of HOME_KEYS) {
    expect({
      key,
      invalidated: queryClient.getQueryState(key)?.isInvalidated,
    }).toEqual({ key, invalidated: true })
  }
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('inbox mutations keep home in sync', () => {
  beforeEach(() => {
    conversationsApi.markConversationRead.mockReset()
    conversationsApi.updateConversationStatus.mockReset()
    messagesApi.sendOutboundMessage.mockReset()
  })

  it('invalidates home after marking a conversation read', async () => {
    conversationsApi.markConversationRead.mockResolvedValue(undefined)
    const queryClient = createTestQueryClient()
    seedHomeQueries(queryClient)

    const { result } = renderHook(() => useMarkConversationRead(WORKSPACE_ID), {
      wrapper: wrapper(queryClient),
    })
    await act(async () => {
      await result.current.mutateAsync(CONVERSATION_ID)
    })

    await waitFor(() => expectHomeInvalidated(queryClient))
  })

  it('invalidates home after a status change', async () => {
    conversationsApi.updateConversationStatus.mockResolvedValue(undefined)
    const queryClient = createTestQueryClient()
    seedHomeQueries(queryClient)

    const { result } = renderHook(
      () => useUpdateConversationStatus(WORKSPACE_ID),
      { wrapper: wrapper(queryClient) },
    )
    await act(async () => {
      await result.current.mutateAsync({
        conversationId: CONVERSATION_ID,
        status: 'closed',
      })
    })

    await waitFor(() => expectHomeInvalidated(queryClient))
  })

  it('invalidates home after sending a message', async () => {
    messagesApi.sendOutboundMessage.mockResolvedValue({
      id: 'm1',
      conversation_id: CONVERSATION_ID,
      created_at: new Date().toISOString(),
      sender_id: 'u1',
      content: 'hi',
      type: 'text',
      metadata: {},
    })
    const queryClient = createTestQueryClient()
    seedHomeQueries(queryClient)

    const { result } = renderHook(
      () => useSendMessage({ workspaceId: WORKSPACE_ID }),
      { wrapper: wrapper(queryClient) },
    )
    await act(async () => {
      await result.current.mutateAsync({
        conversationId: CONVERSATION_ID,
        content: 'hi',
        senderId: 'u1',
        channelType: 'whatsapp',
      })
    })

    await waitFor(() => expectHomeInvalidated(queryClient))
  })

  it('invalidates home when a mutation fails and rolls back', async () => {
    // The optimistic zero is reverted on failure, so home must re-sync too;
    // onSuccess-only wiring would leave it agreeing with a write that never
    // reached the server.
    conversationsApi.markConversationRead.mockRejectedValue(
      new Error('network'),
    )
    const queryClient = createTestQueryClient()
    seedHomeQueries(queryClient)

    const { result } = renderHook(() => useMarkConversationRead(WORKSPACE_ID), {
      wrapper: wrapper(queryClient),
    })
    await act(async () => {
      await result.current.mutateAsync(CONVERSATION_ID).catch(() => undefined)
    })

    await waitFor(() => expectHomeInvalidated(queryClient))
  })
})
