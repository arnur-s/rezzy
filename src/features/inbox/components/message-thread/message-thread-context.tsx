import type { ChannelType } from '@/entities/channel'
import type { MessageReactionRow, MessageRow } from '@/entities/message'
import { createContext, useContext } from 'react'

/**
 * Thread-level context so bubbles can access reactions, reply composition, and
 * the channel type without threading props through the virtualized layers.
 */
export type MessageThreadContextValue = {
  channelType: ChannelType
  /** The other party's display name, for attributing a quoted inbound message. */
  contactName: string
  /**
   * Whether the channel is still connected. An outbound action on a
   * disconnected channel can only fail at the provider, so it is disabled
   * before it is offered.
   */
  isChannelActive: boolean
  reactionsByMessageId: Map<string, Array<MessageReactionRow>>
  /**
   * Sends, replaces, or withdraws this workspace's reaction. Null when the
   * thread has no reaction workflow mounted (the provider cannot send them).
   * The bubble does not know which of the three it is asking for — that follows
   * from what the workspace already holds, and is resolved in the mutation.
   */
  onReactToMessage: ((message: MessageRow, emoji: string) => void) | null
  /**
   * Per-message, so one message waiting on a provider does not disable the
   * reaction control on every other message in the thread.
   */
  isReactionPending: (messageId: string) => boolean
  /**
   * Loaded messages by id. A reply quotes its parent's real author and text
   * from here: channel quote metadata often carries only an external id, and a
   * reply composed in-app carries no quote payload at all.
   */
  messagesById: Map<string, MessageRow>
  onReplyToMessage: ((message: MessageRow) => void) | null
}

const MessageThreadContext = createContext<MessageThreadContextValue | null>(null)

export const MessageThreadProvider = MessageThreadContext.Provider

export function useMessageThreadContext(): MessageThreadContextValue | null {
  return useContext(MessageThreadContext)
}
