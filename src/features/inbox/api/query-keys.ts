export const inboxQueryKeys = {
  all: ['inbox'] as const,
  conversations: (workspaceId: string) =>
    ['inbox', 'conversations', workspaceId] as const,
  messages: (conversationId: string) =>
    ['inbox', 'messages', conversationId] as const,
  contact: (contactId: string) => ['inbox', 'contact', contactId] as const,
}
