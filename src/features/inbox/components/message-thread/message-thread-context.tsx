import type { ChannelType } from '@/entities/channel'
import type { MessageReactionRow, MessageRow } from '@/entities/message'
import { createContext, useContext } from 'react'

/**
 * Thread-level context so bubbles can access reactions, reply composition, and
 * the channel type without threading props through the virtualized layers.
 */
export type MessageThreadContextValue = {
  channelType: ChannelType
  reactionsByMessageId: Map<string, Array<MessageReactionRow>>
  onReplyToMessage: ((message: MessageRow) => void) | null
}

const MessageThreadContext = createContext<MessageThreadContextValue | null>(null)

export const MessageThreadProvider = MessageThreadContext.Provider

export function useMessageThreadContext(): MessageThreadContextValue | null {
  return useContext(MessageThreadContext)
}
