export const inboxQueryKeys = {
  all: ['inbox'] as const,
  conversations: (workspaceId: string) =>
    ['inbox', 'conversations', workspaceId] as const,
  messages: (conversationId: string) =>
    ['inbox', 'messages', conversationId] as const,
  readCursor: (conversationId: string, userId: string) =>
    ['inbox', 'read-cursor', conversationId, userId] as const,
  contact: (contactId: string) => ['inbox', 'contact', contactId] as const,
}
