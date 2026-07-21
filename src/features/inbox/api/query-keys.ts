export const inboxQueryKeys = {
  all: ['inbox'] as const,
  conversations: (workspaceId: string) =>
    ['inbox', 'conversations', workspaceId] as const,
  conversationSearch: (workspaceId: string, query: string) =>
    ['inbox', 'conversations', workspaceId, 'search', query] as const,
  messages: (conversationId: string) =>
    ['inbox', 'messages', conversationId] as const,
  readCursor: (conversationId: string, userId: string) =>
    ['inbox', 'read-cursor', conversationId, userId] as const,
  contact: (contactId: string) => ['inbox', 'contact', contactId] as const,
  // Per-agent unread counts, derived from the current user's read cursor.
  unreadCounts: (workspaceId: string, userId: string) =>
    ['inbox', 'unread-counts', workspaceId, userId] as const,
  unreadCountsForWorkspace: (workspaceId: string) =>
    ['inbox', 'unread-counts', workspaceId] as const,
}
