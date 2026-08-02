import type { MessageReactionRow } from '@/entities/message'
import { groupMessageReactions } from '@/entities/message'
import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inboxQueryKeys } from '../api/query-keys'
import { useReactionsRealtime } from './use-reactions'

/**
 * A reaction is not a message: it updates its own counter and nothing else.
 * These tests pin the two halves of that — the counter stays correct however
 * often a provider re-delivers an event, and the rest of the app (unread
 * badges, conversation previews, notifications) never hears about it.
 */

type ChangeHandler = (payload: { new: MessageReactionRow }) => void

const supabaseMock = vi.hoisted(() => {
  const handlers: Array<ChangeHandler> = []
  const channel = {
    on: vi.fn((_event: string, _filter: unknown, handler: ChangeHandler) => {
      handlers.push(handler)
      return channel
    }),
    subscribe: vi.fn(() => channel),
  }
  return {
    handlers,
    supabase: {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  }
})
vi.mock('@/utils/supabase', () => ({ supabase: supabaseMock.supabase }))

/**
 * The app's two toast entry points. The reaction path imports neither; these
 * spies fail the suite if it ever starts to.
 */
const showToast = vi.hoisted(() => vi.fn())
vi.mock('@astryxdesign/core/Toast', () => ({ useToast: () => showToast }))

const showMessageNotificationToast = vi.hoisted(() => vi.fn())
vi.mock('@/features/notifications/components/message-notification', () => ({
  showMessageNotificationToast,
}))

const WORKSPACE_ID = 'w1'
const CONVERSATION_ID = 'c1'
const USER_ID = 'u1'

function reactionRow(
  overrides: Partial<MessageReactionRow> = {},
): MessageReactionRow {
  return {
    id: 'reaction-1',
    workspace_id: WORKSPACE_ID,
    channel_id: 'channel-1',
    conversation_id: CONVERSATION_ID,
    message_id: 'msg-1',
    provider_message_id: '100',
    reactor_external_id: 'contact-555',
    is_from_contact: true,
    emoji: '❤️',
    action: 'added',
    provider_timestamp: null,
    metadata: {},
    created_at: '2026-08-03T10:00:00Z',
    updated_at: '2026-08-03T10:00:00Z',
    ...overrides,
  }
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

/** Replays a webhook-driven row through every subscribed handler. */
function emit(row: MessageReactionRow) {
  act(() => {
    for (const handler of supabaseMock.handlers) handler({ new: row })
  })
}

function cachedCounters(queryClient: QueryClient) {
  const reactions =
    queryClient.getQueryData<Array<MessageReactionRow>>(
      inboxQueryKeys.reactions(CONVERSATION_ID),
    ) ?? []
  return groupMessageReactions(reactions).map((group) => ({
    emoji: group.emoji,
    count: group.count,
  }))
}

/** Every cache that represents actual messages rather than reactions. */
function seedMessageCounters(queryClient: QueryClient) {
  queryClient.setQueryData(inboxQueryKeys.unreadCounts(WORKSPACE_ID, USER_ID), {
    [CONVERSATION_ID]: 2,
  })
  queryClient.setQueryData(inboxQueryKeys.conversations(WORKSPACE_ID), [
    { id: CONVERSATION_ID, unread_count: 2, last_message_preview: 'See you' },
  ])
  queryClient.setQueryData(inboxQueryKeys.messages(CONVERSATION_ID), {
    pages: [{ messages: [{ id: 'msg-1' }], hasMore: false }],
    pageParams: [null],
  })
}

function messageCountersSnapshot(queryClient: QueryClient) {
  return [
    inboxQueryKeys.unreadCounts(WORKSPACE_ID, USER_ID),
    inboxQueryKeys.conversations(WORKSPACE_ID),
    inboxQueryKeys.messages(CONVERSATION_ID),
  ].map((key) => ({
    data: queryClient.getQueryData(key),
    invalidated: queryClient.getQueryState(key)?.isInvalidated,
  }))
}

describe('useReactionsRealtime', () => {
  beforeEach(() => {
    supabaseMock.handlers.length = 0
    showToast.mockClear()
    showMessageNotificationToast.mockClear()
  })

  function mount() {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData<Array<MessageReactionRow>>(
      inboxQueryKeys.reactions(CONVERSATION_ID),
      [],
    )
    renderHook(() => useReactionsRealtime(CONVERSATION_ID), {
      wrapper: wrapper(queryClient),
    })
    return queryClient
  }

  it('increments the counter when a reaction arrives', () => {
    const queryClient = mount()
    emit(reactionRow())
    expect(cachedCounters(queryClient)).toEqual([{ emoji: '❤', count: 1 }])
  })

  it('counts provider spellings of one emoji in the same group', () => {
    const queryClient = mount()
    emit(reactionRow({ emoji: '❤️' }))
    emit(
      reactionRow({
        id: 'reaction-2',
        reactor_external_id: 'contact-556',
        emoji: '❤',
      }),
    )
    expect(cachedCounters(queryClient)).toEqual([{ emoji: '❤', count: 2 }])
  })

  it('absorbs a duplicate event without incrementing twice', () => {
    const queryClient = mount()
    const row = reactionRow()
    emit(row)
    emit(row)
    emit(row)
    expect(cachedCounters(queryClient)).toEqual([{ emoji: '❤', count: 1 }])
  })

  it('reconciles a realtime row with an optimistic entry already in the cache', () => {
    const queryClient = mount()
    // What an optimistic mutation would write: the right reaction, a
    // placeholder id.
    queryClient.setQueryData<Array<MessageReactionRow>>(
      inboxQueryKeys.reactions(CONVERSATION_ID),
      [reactionRow({ id: 'optimistic-1', is_from_contact: false })],
    )
    emit(reactionRow({ id: 'db-generated-uuid', is_from_contact: false }))
    expect(cachedCounters(queryClient)).toEqual([{ emoji: '❤', count: 1 }])
  })

  it('decrements when a reaction is withdrawn, and drops the empty group', () => {
    const queryClient = mount()
    emit(reactionRow())
    emit(reactionRow({ id: 'reaction-2', reactor_external_id: 'contact-556' }))
    emit(
      reactionRow({
        id: 'reaction-2',
        reactor_external_id: 'contact-556',
        action: 'removed',
      }),
    )
    expect(cachedCounters(queryClient)).toEqual([{ emoji: '❤', count: 1 }])

    emit(reactionRow({ action: 'removed' }))
    expect(cachedCounters(queryClient)).toEqual([])
  })

  it('ignores a repeated withdrawal rather than going negative or erroring', () => {
    const queryClient = mount()
    emit(reactionRow())
    emit(reactionRow({ action: 'removed' }))
    emit(reactionRow({ action: 'removed' }))
    expect(cachedCounters(queryClient)).toEqual([])
    expect(showToast).not.toHaveBeenCalled()
  })

  it('ignores rows belonging to another conversation', () => {
    const queryClient = mount()
    emit(reactionRow({ conversation_id: 'c2' }))
    expect(cachedCounters(queryClient)).toEqual([])
  })

  it('leaves unread-message counters and the conversation list untouched', () => {
    const queryClient = mount()
    seedMessageCounters(queryClient)
    const before = messageCountersSnapshot(queryClient)

    emit(reactionRow())
    emit(reactionRow({ id: 'reaction-2', emoji: '🔥' }))
    emit(reactionRow({ action: 'removed' }))

    expect(messageCountersSnapshot(queryClient)).toEqual(before)
    expect(cachedCounters(queryClient)).toEqual([{ emoji: '🔥', count: 1 }])
  })

  it('never notifies: no toast for a reaction added, removed, or re-delivered', () => {
    mount()
    const row = reactionRow()
    emit(row)
    emit(row)
    emit(reactionRow({ id: 'reaction-2', emoji: '🔥' }))
    emit(reactionRow({ action: 'removed' }))

    expect(showToast).not.toHaveBeenCalled()
    expect(showMessageNotificationToast).not.toHaveBeenCalled()
  })
})
