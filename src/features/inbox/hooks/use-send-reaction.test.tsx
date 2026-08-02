import type { MessageReactionRow } from '@/entities/message'
import {
  OUTBOUND_REACTOR_ID,
  applyReactionRow,
  groupMessageReactions,
} from '@/entities/message'
import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inboxQueryKeys } from '../api/query-keys'
import { useSendReaction } from './use-send-reaction'

/**
 * The optimistic half of outbound reactions.
 *
 * Two things have to hold at once: the chip moves the instant the agent picks
 * an emoji, and the counter is still right after the provider confirms, after a
 * webhook re-delivers, and after a failure puts everything back. Counts are
 * read through `groupMessageReactions` — the same derivation the bubble uses —
 * so these assert what the agent would actually see.
 */

const sendMessageReaction = vi.hoisted(() => vi.fn())
vi.mock('../api/reactions', () => ({
  sendMessageReaction,
  getConversationReactions: vi.fn(),
}))

/**
 * A reaction is silent. The hook imports no toast, and this spy fails the suite
 * if that ever changes.
 */
const showToast = vi.hoisted(() => vi.fn())
vi.mock('@astryxdesign/core/Toast', () => ({ useToast: () => showToast }))

const WORKSPACE_ID = 'w1'
const CONVERSATION_ID = 'c1'
const CHANNEL_ID = 'ch1'
const MESSAGE = { id: 'msg-1', external_id: '100' }

// Spelled by code point: the two heart spellings differ invisibly.
const HEART = String.fromCodePoint(0x2764)
const VS16 = String.fromCodePoint(0xfe0f)
const THUMBS_UP = String.fromCodePoint(0x1f44d)

const reactionsKey = inboxQueryKeys.reactions(CONVERSATION_ID)

function reactionRow(
  overrides: Partial<MessageReactionRow> = {},
): MessageReactionRow {
  return {
    id: 'reaction-1',
    workspace_id: WORKSPACE_ID,
    channel_id: CHANNEL_ID,
    conversation_id: CONVERSATION_ID,
    message_id: MESSAGE.id,
    provider_message_id: MESSAGE.external_id,
    reactor_external_id: '555',
    is_from_contact: true,
    emoji: THUMBS_UP,
    action: 'added',
    provider_timestamp: null,
    metadata: {},
    created_at: '2026-08-03T10:00:00Z',
    updated_at: '2026-08-03T10:00:00Z',
    ...overrides,
  }
}

/** The row the edge function writes once the provider has accepted. */
function confirmedOutboundRow(emoji: string): MessageReactionRow {
  return reactionRow({
    id: 'server-row',
    reactor_external_id: OUTBOUND_REACTOR_ID,
    is_from_contact: false,
    emoji,
  })
}

function setup(seed: Array<MessageReactionRow> = []) {
  const queryClient = createTestQueryClient()
  queryClient.setQueryData(reactionsKey, seed)

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  const view = renderHook(
    () =>
      useSendReaction({
        conversationId: CONVERSATION_ID,
        workspaceId: WORKSPACE_ID,
        channelId: CHANNEL_ID,
      }),
    { wrapper },
  )

  return { ...view, queryClient }
}

function groupsFor(queryClient: QueryClient) {
  const rows =
    queryClient.getQueryData<Array<MessageReactionRow>>(reactionsKey) ?? []
  return groupMessageReactions(rows)
}

function countOf(queryClient: QueryClient, emoji: string): number {
  return groupsFor(queryClient).find((group) => group.emoji === emoji)?.count ?? 0
}

beforeEach(() => {
  vi.clearAllMocks()
  sendMessageReaction.mockResolvedValue(undefined)
})

describe('sending a reaction', () => {
  it('sends the canonical command for the emoji the agent picked', async () => {
    const { result } = setup()

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: THUMBS_UP,
      })
    })

    expect(sendMessageReaction).toHaveBeenCalledWith({
      messageId: MESSAGE.id,
      emoji: THUMBS_UP,
    })
  })

  it('removes when the agent picks the emoji already held', async () => {
    const { result } = setup([confirmedOutboundRow(HEART)])

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: HEART,
      })
    })

    // Removal is the empty reaction, not a second command shape.
    expect(sendMessageReaction).toHaveBeenCalledWith({
      messageId: MESSAGE.id,
      emoji: null,
    })
  })

  it('treats the two spellings of one emoji as the same reaction', async () => {
    // Stored bare (Telegram's spelling); the agent picks the qualified form.
    const { result } = setup([confirmedOutboundRow(HEART)])

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: HEART + VS16,
      })
    })

    // Recognized as the held reaction, so this withdraws rather than replacing.
    expect(sendMessageReaction).toHaveBeenCalledWith({
      messageId: MESSAGE.id,
      emoji: null,
    })
  })

  it('replaces when the agent picks a different emoji', async () => {
    const { result } = setup([confirmedOutboundRow(HEART)])

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: THUMBS_UP,
      })
    })

    expect(sendMessageReaction).toHaveBeenCalledWith({
      messageId: MESSAGE.id,
      emoji: THUMBS_UP,
    })
  })
})

describe('optimistic state', () => {
  it('shows the reaction before the provider answers', async () => {
    let release = () => {}
    sendMessageReaction.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    const { result, queryClient } = setup()

    act(() => {
      void result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: THUMBS_UP,
      })
    })

    await waitFor(() => expect(countOf(queryClient, THUMBS_UP)).toBe(1))
    expect(groupsFor(queryClient)[0]?.reactedByCurrentUser).toBe(true)

    await act(async () => {
      release()
      // Let the mutation's own continuation run before asserting on it.
      await Promise.resolve()
    })
  })

  it('moves the count from the old group to the new one when replacing', async () => {
    const { result, queryClient } = setup([confirmedOutboundRow(HEART)])
    expect(countOf(queryClient, HEART)).toBe(1)

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: THUMBS_UP,
      })
    })

    expect(countOf(queryClient, HEART)).toBe(0)
    expect(countOf(queryClient, THUMBS_UP)).toBe(1)
  })

  it('drops the group entirely on the last removal', async () => {
    const { result, queryClient } = setup([confirmedOutboundRow(HEART)])

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: HEART,
      })
    })

    // Not a group sitting at zero — no group at all.
    expect(groupsFor(queryClient)).toHaveLength(0)
  })

  it('leaves the contact’s own reaction on the same emoji standing', async () => {
    // The contact reacted 👍 too; withdrawing ours must not take theirs.
    const { result, queryClient } = setup([
      reactionRow({ id: 'contact-row', emoji: THUMBS_UP }),
      confirmedOutboundRow(THUMBS_UP),
    ])
    expect(countOf(queryClient, THUMBS_UP)).toBe(2)

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: THUMBS_UP,
      })
    })

    expect(countOf(queryClient, THUMBS_UP)).toBe(1)
    expect(groupsFor(queryClient)[0]?.reactedByCurrentUser).toBe(false)
  })

  it('never produces a negative count', async () => {
    // Withdrawing something we do not hold: the picker cannot ask for this, but
    // a stale cache could.
    const { result, queryClient } = setup([])

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: THUMBS_UP,
      })
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: THUMBS_UP,
      })
    })

    for (const group of groupsFor(queryClient)) {
      expect(group.count).toBeGreaterThanOrEqual(0)
    }
  })

  it('does not leave a reaction on an unrelated message', async () => {
    const { result, queryClient } = setup([
      reactionRow({ id: 'other', message_id: 'msg-2', emoji: HEART }),
    ])

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: THUMBS_UP,
      })
    })

    const rows =
      queryClient.getQueryData<Array<MessageReactionRow>>(reactionsKey) ?? []
    expect(rows.filter((row) => row.message_id === 'msg-2')).toHaveLength(1)
  })
})

describe('pending state', () => {
  it('marks only the message being reacted to as pending', async () => {
    let release = () => {}
    sendMessageReaction.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    const { result } = setup()

    act(() => {
      void result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: THUMBS_UP,
      })
    })

    await waitFor(() =>
      expect(result.current.isMessagePending(MESSAGE.id)).toBe(true),
    )
    // A different message stays reactive while this one waits.
    expect(result.current.isMessagePending('msg-2')).toBe(false)

    await act(async () => {
      release()
      // Let the mutation's own continuation run before asserting on it.
      await Promise.resolve()
    })
    await waitFor(() =>
      expect(result.current.isMessagePending(MESSAGE.id)).toBe(false),
    )
  })
})

describe('reconciliation', () => {
  it('does not double-count when the confirming row arrives', async () => {
    const { result, queryClient } = setup()

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: THUMBS_UP,
      })
    })
    expect(countOf(queryClient, THUMBS_UP)).toBe(1)

    // Realtime delivers the row the edge function wrote. It carries a different
    // primary key from the optimistic entry but the same identity.
    act(() => {
      queryClient.setQueryData<Array<MessageReactionRow>>(
        reactionsKey,
        (current) =>
          applyReactionRow(current ?? [], confirmedOutboundRow(THUMBS_UP)),
      )
    })

    expect(countOf(queryClient, THUMBS_UP)).toBe(1)
  })

  it('does not increment twice when the same event is delivered twice', async () => {
    const { result, queryClient } = setup()

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: THUMBS_UP,
      })
    })

    act(() => {
      queryClient.setQueryData<Array<MessageReactionRow>>(
        reactionsKey,
        (current) => {
          const once = applyReactionRow(
            current ?? [],
            confirmedOutboundRow(THUMBS_UP),
          )
          return applyReactionRow(once, confirmedOutboundRow(THUMBS_UP))
        },
      )
    })

    expect(countOf(queryClient, THUMBS_UP)).toBe(1)
  })

  it('matches a removal that uses the other variation-selector form', async () => {
    const { result, queryClient } = setup()

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: HEART,
      })
    })
    expect(countOf(queryClient, HEART)).toBe(1)

    // The provider echoes the removal spelled the other way.
    act(() => {
      queryClient.setQueryData<Array<MessageReactionRow>>(
        reactionsKey,
        (current) =>
          applyReactionRow(current ?? [], {
            ...confirmedOutboundRow(HEART + VS16),
            action: 'removed',
          }),
      )
    })

    expect(countOf(queryClient, HEART)).toBe(0)
  })
})

describe('failure', () => {
  it('restores the previous reaction when the send fails', async () => {
    sendMessageReaction.mockRejectedValue(new Error('provider refused'))
    const { result, queryClient } = setup([confirmedOutboundRow(HEART)])

    await act(async () => {
      await expect(
        result.current.sendReaction({
          message: MESSAGE,
          selectedEmoji: THUMBS_UP,
        }),
      ).rejects.toThrow('provider refused')
    })

    // The replace is undone in both directions: the new emoji is gone and the
    // one it displaced is back.
    expect(countOf(queryClient, THUMBS_UP)).toBe(0)
    expect(countOf(queryClient, HEART)).toBe(1)
  })

  it('leaves the message reactive again after a failure', async () => {
    sendMessageReaction.mockRejectedValue(new Error('nope'))
    const { result } = setup()

    await act(async () => {
      await expect(
        result.current.sendReaction({
          message: MESSAGE,
          selectedEmoji: THUMBS_UP,
        }),
      ).rejects.toThrow()
    })

    await waitFor(() =>
      expect(result.current.isMessagePending(MESSAGE.id)).toBe(false),
    )
  })
})

describe('reactions stay silent', () => {
  it('shows no toast for add, replace, or remove', async () => {
    const { result } = setup()

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: THUMBS_UP,
      })
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: HEART,
      })
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: HEART,
      })
    })

    expect(showToast).not.toHaveBeenCalled()
  })

  it('touches no cache but the reactions of this conversation', async () => {
    const { result, queryClient } = setup()
    const otherKeys = [
      inboxQueryKeys.messages(CONVERSATION_ID),
      inboxQueryKeys.conversations(WORKSPACE_ID),
      inboxQueryKeys.unreadCounts(WORKSPACE_ID, 'u1'),
    ]
    for (const key of otherKeys) {
      queryClient.setQueryData(key, { untouched: true })
    }

    await act(async () => {
      await result.current.sendReaction({
        message: MESSAGE,
        selectedEmoji: THUMBS_UP,
      })
    })

    // Unread counters and conversation previews are message state. A reaction
    // is not a message, and must not move either of them.
    for (const key of otherKeys) {
      expect(queryClient.getQueryData(key)).toEqual({ untouched: true })
    }
  })
})
