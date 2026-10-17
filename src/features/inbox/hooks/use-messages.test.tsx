import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import type { MessageRow } from '@/entities/message'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inboxQueryKeys } from '../api/query-keys'
import type { MessagesPageResult } from '../api/messages'
import {
  useMarkConversationReadToMessage,
  useSendMessage,
} from './use-messages'

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

const sendOutboundMessage = vi.hoisted(() => vi.fn())
vi.mock('../api/messages', () => ({ sendOutboundMessage }))

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

describe('useSendMessage rollback', () => {
  function message(
    id: string,
    overrides: Partial<MessageRow> = {},
  ): MessageRow {
    return {
      id,
      conversation_id: 'c1',
      workspace_id: 'w1',
      sender_id: null,
      direction: 'inbound',
      type: 'text',
      status: 'delivered',
      content: id,
      media_url: null,
      media_filename: null,
      media_mime_type: null,
      media_size: null,
      metadata: {},
      external_id: null,
      reply_to_message_id: null,
      external_reply_to_id: null,
      edited_at: null,
      deleted_at: null,
      provider_timestamp: null,
      created_at: '2026-10-17T10:00:00Z',
      ...overrides,
    }
  }

  it.each([false, true])(
    'keeps concurrent realtime arrivals after failed send (existing cache: %s)',
    async (hasCache) => {
      const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
      })
      const key = inboxQueryKeys.messages('c1')
      if (hasCache) {
        queryClient.setQueryData(key, {
          pages: [{ messages: [message('earlier')], hasMore: false }],
          pageParams: [null],
        })
      }
      let rejectSend: (reason: Error) => void = () => {
        throw new Error('Send not started')
      }
      sendOutboundMessage.mockImplementation(
        () =>
          new Promise<MessageRow>((_resolve, reject) => {
            rejectSend = reject
          }),
      )
      const { result } = renderHook(
        () => useSendMessage({ workspaceId: 'w1' }),
        { wrapper: createWrapper(queryClient) },
      )

      result.current.mutate({
        conversationId: 'c1',
        content: 'reply',
        senderId: 'u1',
        channelType: 'telegram',
      })
      await waitFor(() => expect(result.current.isPending).toBe(true))
      await waitFor(() => expect(sendOutboundMessage).toHaveBeenCalled())
      queryClient.setQueryData<InfiniteData<MessagesPageResult>>(
        key,
        (current) =>
          current && {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              messages: [...page.messages, message('new-arrival')],
            })),
          },
      )
      rejectSend(new Error('Provider rejected'))
      await waitFor(() => expect(result.current.isError).toBe(true))

      const ids = queryClient
        .getQueryData<InfiniteData<MessagesPageResult>>(key)
        ?.pages.flatMap((page) => page.messages.map((row) => row.id))
      expect(ids).toEqual(
        hasCache ? ['earlier', 'new-arrival'] : ['new-arrival'],
      )
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    },
  )

  it('keeps a persisted failed row received through realtime so retry remains available', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    const key = inboxQueryKeys.messages('c1')
    let rejectSend: (reason: Error) => void = () => {
      throw new Error('Send not started')
    }
    sendOutboundMessage.mockImplementation(
      () =>
        new Promise<MessageRow>((_resolve, reject) => {
          rejectSend = reject
        }),
    )
    const { result } = renderHook(() => useSendMessage({ workspaceId: 'w1' }), {
      wrapper: createWrapper(queryClient),
    })
    result.current.mutate({
      conversationId: 'c1',
      content: 'reply',
      senderId: 'u1',
      channelType: 'telegram',
    })
    await waitFor(() => expect(sendOutboundMessage).toHaveBeenCalled())
    queryClient.setQueryData<InfiniteData<MessagesPageResult>>(
      key,
      (current) =>
        current && {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            messages: page.messages.map((row) => ({
              ...row,
              status: 'failed',
            })),
          })),
        },
    )
    rejectSend(new Error('Provider rejected'))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(
      queryClient.getQueryData<InfiniteData<MessagesPageResult>>(key)?.pages[0]
        ?.messages[0]?.status,
    ).toBe('failed')
  })
})
