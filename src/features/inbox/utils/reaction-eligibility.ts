import type { ChannelType } from '@/entities/channel'
import { getReactionCapabilities } from '@/entities/channel'
import type { MessageRow, MessageType } from '@/entities/message'
import { isMessageType } from '@/entities/message'

/**
 * Why a reaction cannot be sent for a message whose channel otherwise supports
 * reactions. Each maps to a sentence the trigger can state, so a disabled
 * control is never silently disabled.
 */
export type ReactionBlockedReason =
  | 'message_deleted'
  | 'missing_provider_id'
  | 'channel_disconnected'

/**
 * `hidden` means reactions are fundamentally unavailable here — a provider that
 * cannot send them, or a message that cannot carry one — so the affordance is
 * not drawn at all. `blocked` means the affordance belongs but this message
 * cannot take it right now, which is a disabled control with a reason.
 */
export type ReactionAvailability =
  | { status: 'hidden' }
  | { status: 'blocked'; reason: ReactionBlockedReason }
  | { status: 'available' }

/**
 * Message kinds that cannot carry a reaction. `system` messages are our own
 * notices rather than provider messages, and `unsupported` is the placeholder
 * for a payload we could not parse — neither has anything a provider would
 * accept a reaction against.
 */
const UNREACTABLE_TYPES = new Set<MessageType>(['system', 'unsupported'])

/**
 * Whether the reaction affordance should be shown for a message, and if shown,
 * whether it can be used.
 *
 * The order matters: capability first, so an unsupported provider never renders
 * a disabled control explaining itself; then message shape; then the transient
 * conditions, which are the only ones that resolve on their own.
 */
export function getReactionAvailability({
  channelType,
  message,
  isChannelActive,
}: {
  channelType: ChannelType
  message: Pick<MessageRow, 'type' | 'deleted_at' | 'external_id'>
  isChannelActive: boolean
}): ReactionAvailability {
  if (!getReactionCapabilities(channelType).canSend) {
    return { status: 'hidden' }
  }

  const type: MessageType = isMessageType(message.type) ? message.type : 'text'
  if (UNREACTABLE_TYPES.has(type)) {
    return { status: 'hidden' }
  }

  if (message.deleted_at) {
    return { status: 'blocked', reason: 'message_deleted' }
  }

  // Every provider addresses the reaction target by its own message id. A
  // message still in flight, or one that failed to send, has none yet.
  if (!message.external_id?.trim()) {
    return { status: 'blocked', reason: 'missing_provider_id' }
  }

  if (!isChannelActive) {
    return { status: 'blocked', reason: 'channel_disconnected' }
  }

  return { status: 'available' }
}
