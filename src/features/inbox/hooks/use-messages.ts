import type { ChannelType } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import { sortConversationsByActivity } from '@/entities/conversation'
import type { MessageRow } from '@/entities/message'
import { useInvalidateDashboard } from '@/features/dashboard/hooks/use-invalidate-dashboard'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useMemo } from 'react'
import type { MessagePageCursor } from '../api/messages'
import {
  getConversationMessagesPage,
  retryOutboundMessage,
  sendOutboundMessage,
} from '../api/messages'
import { inboxQueryKeys } from '../api/query-keys'
import type { ConversationReadCursor } from '../api/read-cursors'
import {
  getConversationReadCursor,
  markConversationReadToMessage,
} from '../api/read-cursors'
import { listPreviewFromMessage } from '../schemas/message-metadata'
import {
  appendMessageToNewestPage,
  flattenMessagePages,
  getNextPageCursorFromPages,
  patchInfiniteMessagesCache,
} from '../utils/message-pages'

export function useMessages(conversationId: string | null) {
  const query = useInfiniteQuery({
    queryFn: ({ pageParam }) =>
      getConversationMessagesPage({
        conversationId: conversationId!,
        cursor: pageParam,
      }),
    queryKey: inboxQueryKeys.messages(conversationId ?? ''),
    enabled: !!conversationId,
    initialPageParam: null as MessagePageCursor | null,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined
      return getNextPageCursorFromPages(allPages)
    },
  })

  const messages = useMemo(
    () => flattenMessagePages(query.data?.pages),
    [query.data?.pages],
  )

  return {
    messages,
    isPending: query.isPending,
    isError: query.isError,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  }
}

export function useConversationReadCursor({
  conversationId,
  userId,
}: {
  conversationId: string | null
  userId: string | null
}) {
  return useQuery({
    queryFn: () =>
      getConversationReadCursor({
        conversationId: conversationId!,
        userId: userId!,
      }),
    queryKey: inboxQueryKeys.readCursor(conversationId ?? '', userId ?? ''),
    enabled: !!conversationId && !!userId,
  })
}

export function useMarkConversationReadToMessage({
  workspaceId,
  userId,
}: {
  workspaceId: string
  userId: string | null
}) {
  const queryClient = useQueryClient()
  const invalidateDashboard = useInvalidateDashboard()
  const conversationsKey = inboxQueryKeys.conversations(workspaceId)

  return useMutation({
    mutationFn: ({
      conversationId,
      lastReadMessageId,
    }: {
      conversationId: string
      lastReadMessageId: string
    }) => markConversationReadToMessage({ conversationId, lastReadMessageId }),
    onSuccess: (_data, { conversationId, lastReadMessageId }) => {
      queryClient.setQueryData<Array<ConversationWithRelations>>(
        conversationsKey,
        (current) =>
          current?.map((row) =>
            row.id === conversationId ? { ...row, unread_count: 0 } : row,
          ),
      )

      // The conversation-list badge is driven by the per-agent unread-counts
      // map (overlaid onto rows in inbox-page), not conversations.unread_count.
      // Clear this conversation's entry so the badge reflects the read cursor we
      // just advanced; otherwise the count lingers until the map is refetched.
      queryClient.setQueriesData<Record<string, number>>(
        { queryKey: inboxQueryKeys.unreadCountsForWorkspace(workspaceId) },
        (current) => (current ? { ...current, [conversationId]: 0 } : current),
      )

      if (!userId) return

      queryClient.setQueryData<ConversationReadCursor | null>(
        inboxQueryKeys.readCursor(conversationId, userId),
        {
          last_read_message_id: lastReadMessageId,
          last_read_at: new Date().toISOString(),
        },
      )
    },
    // Advancing the read cursor is what actually clears unread for this agent,
    // so home's unread count and its "unread" attention rows both move with it.
    onSettled: invalidateDashboard,
  })
}

export function useSendMessage({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient()
  const invalidateDashboard = useInvalidateDashboard()

  return useMutation({
    mutationFn: (variables: {
      conversationId: string
      content: string
      file?: File | null
      senderId: string | null
      channelType: ChannelType
      clientMessageId?: string
      replyToMessageId?: string | null
    }) =>
      sendOutboundMessage({
        id: variables.clientMessageId,
        conversationId: variables.conversationId,
        workspaceId,
        content: variables.content,
        file: variables.file,
        senderId: variables.senderId,
        channelType: variables.channelType,
        replyToMessageId: variables.replyToMessageId,
      }),

    onMutate: async (variables) => {
      const { conversationId, content, senderId, file } = variables

      // Share one client-generated id between the optimistic row and the real
      // DB row so the realtime INSERT dedups by id instead of showing a copy.
      const clientMessageId = crypto.randomUUID()
      variables.clientMessageId = clientMessageId

      if (file) return null

      const messagesKey = inboxQueryKeys.messages(conversationId)
      await queryClient.cancelQueries({ queryKey: messagesKey })

      const snapshot = queryClient.getQueryData(messagesKey)
      const tempId = clientMessageId

      const tempMessage: MessageRow = {
        id: tempId,
        conversation_id: conversationId,
        workspace_id: workspaceId,
        sender_id: senderId,
        direction: 'outbound',
        type: 'text',
        status: 'sent',
        content: content.trim() || null,
        media_url: null,
        media_filename: null,
        media_mime_type: null,
        media_size: null,
        metadata: {},
        external_id: null,
        reply_to_message_id: variables.replyToMessageId ?? null,
        external_reply_to_id: null,
        edited_at: null,
        deleted_at: null,
        provider_timestamp: null,
        created_at: new Date().toISOString(),
      }

      patchInfiniteMessagesCache(queryClient, messagesKey, (current) => {
        if (!current) {
          return {
            pages: [{ messages: [tempMessage], hasMore: false }],
            pageParams: [null],
          }
        }
        return {
          ...current,
          pages: appendMessageToNewestPage(current.pages, tempMessage),
        }
      })

      return { snapshot, tempId, messagesKey }
    },

    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(context.messagesKey, context.snapshot)
      }
    },

    onSuccess: (message, _variables, context) => {
      const messagesKey = inboxQueryKeys.messages(message.conversation_id)
      const conversationsKey = inboxQueryKeys.conversations(workspaceId)

      patchInfiniteMessagesCache(queryClient, messagesKey, (current) => {
        if (!current) {
          return {
            pages: [{ messages: [message], hasMore: false }],
            pageParams: [null],
          }
        }

        const pages = context?.tempId
          ? current.pages.map((page) => ({
              ...page,
              messages: page.messages.filter((m) => m.id !== context.tempId),
            }))
          : current.pages

        return {
          ...current,
          pages: appendMessageToNewestPage(pages, message),
        }
      })

      queryClient.setQueryData<Array<ConversationWithRelations>>(
        conversationsKey,
        (current) => {
          if (!current) return current

          return sortConversationsByActivity(
            current.map((conversation) =>
              conversation.id === message.conversation_id
                ? {
                    ...conversation,
                    last_message_at: message.created_at,
                    last_message_preview: listPreviewFromMessage(message),
                    assigned_to:
                      conversation.assigned_to ?? message.sender_id ?? null,
                  }
                : conversation,
            ),
          )
        },
      )
    },
    // Replying refreshes last_message_at, which is what home's staleness
    // threshold reads, and can claim an unassigned thread for this agent.
    onSettled: invalidateDashboard,
  })
}

/** Re-dispatches a failed outbound message and patches the fresh row in place. */
export function useRetryMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: { messageId: string; channelType: ChannelType }) =>
      retryOutboundMessage(variables),
    onSuccess: (message) => {
      const messagesKey = inboxQueryKeys.messages(message.conversation_id)
      patchInfiniteMessagesCache(queryClient, messagesKey, (current) => {
        if (!current) return current
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            messages: page.messages.map((row) =>
              row.id === message.id ? { ...row, ...message } : row,
            ),
          })),
        }
      })
    },
  })
}
