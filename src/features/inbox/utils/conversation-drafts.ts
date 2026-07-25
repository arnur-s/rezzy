/**
 * Per-conversation composer drafts.
 *
 * The composer remounts on every conversation switch (ChatLayout is keyed by
 * conversation id) and typed text otherwise lives only in local state, so a
 * thread switch — or a reflexive Escape — used to discard an in-progress reply
 * with no recovery. Drafts are held here instead: an in-memory map that
 * survives the remount, mirrored to sessionStorage so a full reload keeps them
 * too. Only text is persisted; attachments (File objects) are intentionally
 * ephemeral.
 */

const STORAGE_PREFIX = 'rezzy:draft:'

const memoryDrafts = new Map<string, string>()

function storageKey(conversationId: string): string {
  return `${STORAGE_PREFIX}${conversationId}`
}

export function getConversationDraft(conversationId: string): string {
  const cached = memoryDrafts.get(conversationId)
  if (cached !== undefined) return cached
  try {
    return sessionStorage.getItem(storageKey(conversationId)) ?? ''
  } catch {
    return ''
  }
}

export function setConversationDraft(
  conversationId: string,
  text: string,
): void {
  if (text.length === 0) {
    clearConversationDraft(conversationId)
    return
  }
  memoryDrafts.set(conversationId, text)
  try {
    sessionStorage.setItem(storageKey(conversationId), text)
  } catch {
    /* storage full or unavailable — the in-memory copy still holds */
  }
}

export function clearConversationDraft(conversationId: string): void {
  memoryDrafts.delete(conversationId)
  try {
    sessionStorage.removeItem(storageKey(conversationId))
  } catch {
    /* ignore */
  }
}
