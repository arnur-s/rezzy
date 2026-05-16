import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query'
import type { MessagesPageResult, MessagePageCursor } from '../api/messages'
import type { MessageRow } from '@/entities/message'

export function flattenMessagePages(
  pages: Array<MessagesPageResult> | undefined,
): Array<MessageRow> {
  if (!pages?.length) return []
  return [...pages].reverse().flatMap((page) => page.messages)
}

export function getOldestMessageCursor(
  messages: Array<MessageRow>,
): MessagePageCursor | null {
  const oldest = messages[0]
  if (!oldest) return null
  return { createdAt: oldest.created_at, id: oldest.id }
}

export function getNextPageCursorFromPages(
  pages: Array<MessagesPageResult>,
): MessagePageCursor | undefined {
  const lastPage = pages.at(-1)
  if (!lastPage?.hasMore) return undefined
  const oldest = lastPage.messages[0]
  if (!oldest) return undefined
  return { createdAt: oldest.created_at, id: oldest.id }
}

export function sortMessagesChronologically(
  messages: Array<MessageRow>,
): Array<MessageRow> {
  return [...messages].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

export function appendMessageToNewestPage(
  pages: Array<MessagesPageResult>,
  message: MessageRow,
): Array<MessagesPageResult> {
  if (pages.length === 0) {
    return [{ messages: [message], hasMore: false }]
  }

  const [newest, ...rest] = pages
  if (newest.messages.some((row) => row.id === message.id)) {
    return pages
  }

  return [
    {
      ...newest,
      messages: sortMessagesChronologically([...newest.messages, message]),
    },
    ...rest,
  ]
}

export function updateMessageInPages(
  pages: Array<MessagesPageResult>,
  message: MessageRow,
): Array<MessagesPageResult> {
  return pages.map((page) => ({
    ...page,
    messages: page.messages.map((row) =>
      row.id === message.id ? { ...row, ...message } : row,
    ),
  }))
}

export function patchInfiniteMessagesCache(
  queryClient: QueryClient,
  key: QueryKey,
  updater: (
    current: InfiniteData<MessagesPageResult> | undefined,
  ) => InfiniteData<MessagesPageResult> | undefined,
): void {
  queryClient.setQueryData<InfiniteData<MessagesPageResult>>(key, updater)
}
