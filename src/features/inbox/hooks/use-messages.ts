import type { ChannelType } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import { sortConversationsByActivity } from '@/entities/conversation'
import type { MessageRow } from '@/entities/message'
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

      if (!userId) return

      queryClient.setQueryData<ConversationReadCursor | null>(
        inboxQueryKeys.readCursor(conversationId, userId),
        {
          last_read_message_id: lastReadMessageId,
          last_read_at: new Date().toISOString(),
        },
      )
    },
  })
}

export function useSendMessage({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: {
      conversationId: string
      content: string
      file?: File | null
      senderId: string | null
      channelType: ChannelType
      clientMessageId?: string
    }) =>
      sendOutboundMessage({
        id: variables.clientMessageId,
        conversationId: variables.conversationId,
        workspaceId,
        content: variables.content,
        file: variables.file,
        senderId: variables.senderId,
        channelType: variables.channelType,
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
  })
}
