import type { MessageReactionRow } from '@/entities/message'
import {
  OUTBOUND_REACTOR_ID,
  applyReactionRow,
  groupMessageReactions,
} from '@/entities/message'
import { normalizeReactionEmoji } from '@/lib/reaction-emoji'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { inboxQueryKeys } from '../api/query-keys'
import { sendMessageReaction } from '../api/reactions'

/**
 * The emoji this workspace currently holds on a message, canonical, or null.
 *
 * Read from the same records the chips are drawn from, so "what will clicking
 * ❤ do" and "what does the bubble show" can never disagree.
 */
export function currentOutboundReaction(
  reactions: ReadonlyArray<MessageReactionRow>,
): string | null {
  for (const group of groupMessageReactions(reactions)) {
    if (group.reactions.some((row) => !row.is_from_contact)) return group.emoji
  }
  return null
}

/**
 * What selecting an emoji means, given what the workspace already holds. One
 * reaction per actor: selecting the emoji already held withdraws it, and
 * selecting another swaps it in a single provider call.
 */
export function resolveReactionIntent({
  selectedEmoji,
  currentEmoji,
}: {
  selectedEmoji: string
  currentEmoji: string | null
}): { emoji: string | null; kind: 'add' | 'replace' | 'remove' } {
  const selected = normalizeReactionEmoji(selectedEmoji)
  if (currentEmoji && normalizeReactionEmoji(currentEmoji) === selected) {
    return { emoji: null, kind: 'remove' }
  }
  return { emoji: selected, kind: currentEmoji ? 'replace' : 'add' }
}

type SendInput = {
  message: { id: string; external_id: string | null }
  /** The emoji the agent selected — not necessarily the one that gets sent. */
  selectedEmoji: string
}

type SendVariables = SendInput & {
  /**
   * The command that will actually go to the provider: the selected emoji, or
   * null to withdraw. Resolved once, before the mutation starts, because
   * `onMutate` rewrites the very cache the intent is read from — deriving it
   * again inside `mutationFn` would read our own optimistic row back and turn
   * every replace into a removal.
   */
  emoji: string | null
}

/**
 * Sends the workspace's reaction and keeps the transcript honest while it is in
 * flight.
 *
 * Nothing here announces success. A reaction is secondary activity: it shows up
 * as a chip under the bubble and nowhere else — no toast, no conversation
 * preview, no unread counter, no notification. Only a failed send, which the
 * agent asked for and did not get, is worth interrupting them for, and the
 * caller decides how to say it.
 */
export function useSendReaction({
  conversationId,
  workspaceId,
  channelId,
}: {
  conversationId: string
  workspaceId: string
  channelId: string
}) {
  const queryClient = useQueryClient()
  const reactionsKey = inboxQueryKeys.reactions(conversationId)

  // Per-message, so one message waiting on a provider does not freeze the
  // reaction control on every other message in the thread.
  const [pendingMessageIds, setPendingMessageIds] = useState<ReadonlySet<string>>(
    new Set(),
  )

  const markPending = useCallback((messageId: string, isPending: boolean) => {
    setPendingMessageIds((current) => {
      if (current.has(messageId) === isPending) return current
      const next = new Set(current)
      if (isPending) {
        next.add(messageId)
      } else {
        next.delete(messageId)
      }
      return next
    })
  }, [])

  const mutation = useMutation({
    mutationFn: ({ message, emoji }: SendVariables) =>
      sendMessageReaction({ messageId: message.id, emoji }),

    onMutate: async ({ message, emoji }) => {
      markPending(message.id, true)
      // Cancelling in-flight refetches keeps a response that predates this
      // click from overwriting the optimistic row a moment after it lands.
      await queryClient.cancelQueries({ queryKey: reactionsKey })

      const snapshot =
        queryClient.getQueryData<Array<MessageReactionRow>>(reactionsKey)

      queryClient.setQueryData<Array<MessageReactionRow>>(
        reactionsKey,
        (current) => {
          // Replacing and removing both start by withdrawing what we hold: the
          // old group loses its record, and a group with no records stops
          // existing rather than lingering at zero.
          const withoutOurs = (current ?? []).filter(
            (row) =>
              row.message_id !== message.id ||
              row.reactor_external_id !== OUTBOUND_REACTOR_ID,
          )
          if (!emoji) return withoutOurs

          // Folded in through the same function realtime uses, so the
          // confirming row replaces this one by identity instead of joining it.
          return applyReactionRow(
            withoutOurs,
            optimisticReactionRow({
              workspaceId,
              channelId,
              conversationId,
              message,
              emoji,
            }),
          )
        },
      )

      return { snapshot }
    },

    onError: (_error, _variables, context) => {
      // Put back exactly what was there, so a failed replace restores the
      // previous emoji rather than leaving the message bare.
      if (context?.snapshot) {
        queryClient.setQueryData(reactionsKey, context.snapshot)
      }
    },

    onSettled: (_data, _error, variables) => {
      markPending(variables.message.id, false)
      // Realtime is the normal path back; this is the backstop for a dropped
      // subscription. Re-fetched rows fold through applyReactionRow, so
      // arriving twice cannot double a counter.
      void queryClient.invalidateQueries({ queryKey: reactionsKey })
    },
  })

  const isMessagePending = useCallback(
    (messageId: string) => pendingMessageIds.has(messageId),
    [pendingMessageIds],
  )

  const { mutateAsync } = mutation

  /**
   * Callers say which emoji was picked; what that means — add, replace, or
   * withdraw — is worked out here, against the state on screen at the moment of
   * the click.
   */
  const sendReaction = useCallback(
    ({ message, selectedEmoji }: SendInput) => {
      const currentEmoji = currentOutboundReaction(
        readReactionsForMessage(
          queryClient.getQueryData(reactionsKey),
          message.id,
        ),
      )
      const intent = resolveReactionIntent({ selectedEmoji, currentEmoji })
      return mutateAsync({ message, selectedEmoji, emoji: intent.emoji })
    },
    [mutateAsync, queryClient, reactionsKey],
  )

  return { sendReaction, isMessagePending }
}

function readReactionsForMessage(
  reactions: Array<MessageReactionRow> | undefined,
  messageId: string,
): Array<MessageReactionRow> {
  return (reactions ?? []).filter((row) => row.message_id === messageId)
}

/**
 * The row the chip is drawn from until the confirming row arrives. Its identity
 * columns are real — the provider message id, the workspace reactor id, the
 * canonical emoji — so the two rows collapse into one on arrival; only the
 * primary key is client-side, and nothing matches on it.
 */
function optimisticReactionRow({
  workspaceId,
  channelId,
  conversationId,
  message,
  emoji,
}: {
  workspaceId: string
  channelId: string
  conversationId: string
  message: { id: string; external_id: string | null }
  emoji: string
}): MessageReactionRow {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    channel_id: channelId,
    conversation_id: conversationId,
    message_id: message.id,
    provider_message_id: message.external_id ?? '',
    reactor_external_id: OUTBOUND_REACTOR_ID,
    is_from_contact: false,
    emoji,
    action: 'added',
    provider_timestamp: null,
    metadata: {},
    created_at: now,
    updated_at: now,
  }
}
