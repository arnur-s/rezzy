export const contactNoteQueryKeys = {
  all: ['contact-notes'] as const,
  lists: () => [...contactNoteQueryKeys.all, 'list'] as const,
  list: (workspaceId: string, contactId: string) =>
    [...contactNoteQueryKeys.lists(), workspaceId, contactId] as const,
}
