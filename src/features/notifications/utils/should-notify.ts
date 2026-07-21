import type { MessageNotificationRow } from '../model/types'

export type ShouldPresentInAppParams = {
  /** The in-app delivery preference. */
  inAppEnabled: boolean
  /**
   * Whether this tab currently has OS-level focus — not just Page Visibility.
   * A tab stays `document.visibilityState === 'visible'` while the user has
   * switched to another application, so visibility alone isn't enough: pass
   * `document.visibilityState === 'visible' && document.hasFocus()`.
   */
  isFocused: boolean
  /** Workspace of the conversation currently open in this tab, if any. */
  openWorkspaceId: string | null
  /** Conversation currently open in this tab, if any. */
  openConversationId: string | null
  notification: Pick<MessageNotificationRow, 'workspace_id' | 'conversation_id'>
}

/**
 * Decide whether to show an in-app notification for an eligible recipient.
 *
 * Suppressed only when the agent is actively looking at the exact conversation
 * (tab focused + same workspace + same conversation) — they already see the
 * message inserted in the open thread. An unfocused tab never shows an in-app
 * notification (the push/OS path covers that case instead), and the in-app
 * preference gates everything. Every other case (different thread, different
 * workspace) still shows.
 *
 * This decision is per-tab and does not affect other workspace members: each
 * recipient's own tab evaluates its own focus state and open conversation.
 */
export function shouldPresentInApp({
  inAppEnabled,
  isFocused,
  openWorkspaceId,
  openConversationId,
  notification,
}: ShouldPresentInAppParams): boolean {
  if (!inAppEnabled) return false
  if (!isFocused) return false
  const viewingExactThread =
    openConversationId === notification.conversation_id &&
    openWorkspaceId === notification.workspace_id
  return !viewingExactThread
}
