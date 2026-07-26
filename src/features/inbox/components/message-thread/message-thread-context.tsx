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
  reactionsByMessageId: Map<string, Array<MessageReactionRow>>
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
