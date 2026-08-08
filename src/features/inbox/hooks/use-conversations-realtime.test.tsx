import { inboxQueryKeys } from '@/features/inbox/api/query-keys'
import { useConversationsRealtime } from '@/features/inbox/hooks/use-conversations-realtime'
import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Archiving reaches the inbox as an UPDATE, never a DELETE — `deleted_at` is
 * stamped, the row is not removed. `postgres_changes` filters cannot express
 * "and deleted_at is null" (they take a single column, and `workspace_id`
 * already holds the one slot), so this handler is the only thing keeping an
 * archived conversation out of the list.
 *
 * Both directions are pinned here. The unarchive direction is the subtler one:
 * the row is absent from the cache, so a merge-by-id would quietly do nothing
 * and the returning customer's conversation would stay missing until a refetch.
 */

const conversationsApi = vi.hoisted(() => ({ getConversationById: vi.fn() }))

vi.mock('@/features/inbox/api/conversations', () => ({
  getConversationById: conversationsApi.getConversationById,
}))

type ChangeHandler = (payload: {
  new?: Record<string, unknown>
  old?: Record<string, unknown>
}) => void

/**
 * Captures the handler registered for each postgres_changes event so a test can
 * deliver a payload without a live socket.
 */
const handlers = new Map<string, ChangeHandler>()

const channelMock = {
  on: vi.fn(
    (
      _type: string,
      config: { event: string },
      handler: ChangeHandler,
    ) => {
      handlers.set(config.event, handler)
      return channelMock
    },
  ),
  subscribe: vi.fn(() => channelMock),
}

vi.mock('@/utils/supabase', () => ({
  supabase: {
    channel: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  },
}))

const WORKSPACE_ID = 'w1'

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function conversationRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    workspace_id: WORKSPACE_ID,
    channel_id: 'ch1',
    contact_id: 'ct1',
    assigned_to: null,
    status: 'open',
    last_message_at: '2026-08-08T10:00:00.000Z',
    last_message_preview: 'hi',
    snoozed_until: null,
    external_thread_id: null,
    last_inbound_at: null,
    created_at: '2026-08-01T10:00:00.000Z',
    updated_at: '2026-08-08T10:00:00.000Z',
    unread_count: 0,
    channel: { id: 'ch1', type: 'telegram', name: 'TG', is_active: true },
    contact: {
      id: 'ct1',
      name: 'Person',
      phone: null,
      avatar_url: null,
      status: 'new',
    },
    ...overrides,
  }
}

describe('useConversationsRealtime and archived conversations', () => {
  beforeEach(() => {
    handlers.clear()
    conversationsApi.getConversationById.mockReset()
  })

  it('drops a conversation from the list when the update carries deleted_at', () => {
    const queryClient = createTestQueryClient()
    const key = inboxQueryKeys.conversations(WORKSPACE_ID)
    queryClient.setQueryData(key, [
      conversationRow('c1'),
      conversationRow('c2'),
    ])

    renderHook(() => useConversationsRealtime(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    handlers.get('UPDATE')?.({
      new: { ...conversationRow('c1'), deleted_at: '2026-08-08T12:00:00.000Z' },
    })

    const rows = queryClient.getQueryData<Array<{ id: string }>>(key)
    expect(rows?.map((row) => row.id)).toEqual(['c2'])
  })

  it('does not merge an archived row back in as a normal update', () => {
    const queryClient = createTestQueryClient()
    const key = inboxQueryKeys.conversations(WORKSPACE_ID)
    queryClient.setQueryData(key, [conversationRow('c1')])

    renderHook(() => useConversationsRealtime(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    handlers.get('UPDATE')?.({
      new: {
        ...conversationRow('c1', { last_message_preview: 'archived after this' }),
        deleted_at: '2026-08-08T12:00:00.000Z',
      },
    })

    expect(queryClient.getQueryData(key)).toEqual([])
    // An archived conversation must not be refetched as though it were new.
    expect(conversationsApi.getConversationById).not.toHaveBeenCalled()
  })

  it('fetches and inserts a conversation whose deleted_at was just cleared', async () => {
    const queryClient = createTestQueryClient()
    const key = inboxQueryKeys.conversations(WORKSPACE_ID)
    queryClient.setQueryData(key, [conversationRow('c2')])
    conversationsApi.getConversationById.mockResolvedValue(
      conversationRow('c1', { last_message_at: '2026-08-09T09:00:00.000Z' }),
    )

    renderHook(() => useConversationsRealtime(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    // What an inbound message from an archived contact produces: the row
    // becomes visible, so this is the first event this client sees for it.
    handlers.get('UPDATE')?.({
      new: { ...conversationRow('c1'), deleted_at: null },
    })

    await waitFor(() => {
      const rows = queryClient.getQueryData<Array<{ id: string }>>(key)
      expect(rows?.map((row) => row.id)).toEqual(['c1', 'c2'])
    })
    expect(conversationsApi.getConversationById).toHaveBeenCalledWith('c1')
  })

  it('still merges an ordinary update in place', () => {
    const queryClient = createTestQueryClient()
    const key = inboxQueryKeys.conversations(WORKSPACE_ID)
    queryClient.setQueryData(key, [conversationRow('c1')])

    renderHook(() => useConversationsRealtime(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    handlers.get('UPDATE')?.({
      new: { ...conversationRow('c1'), status: 'closed' },
    })

    const rows =
      queryClient.getQueryData<Array<{ id: string; status: string }>>(key)
    expect(rows).toHaveLength(1)
    expect(rows?.[0]?.status).toBe('closed')
    expect(conversationsApi.getConversationById).not.toHaveBeenCalled()
  })
})
