export { formatFileSize } from './lib/format-file-size'
export {
  applyReactionRow,
  dedupeReactions,
  displayReactionEmoji,
  groupMessageReactions,
} from './lib/message-reactions'
export type { MessageReactionGroup } from './lib/message-reactions'
export {
  OUTBOUND_REACTOR_ID,
  canonicalizeReaction,
  isOutboundReaction,
  reactionIdentity,
} from './lib/reaction-identity'
export {
  hasSharedContactIdentity,
  parseSharedContacts,
  sharedContactName,
  sharedContactPrimaryPhone,
  sharedContactToText,
  toSharedContact,
} from './lib/shared-contact'
export type {
  SharedContact,
  SharedContactIdentity,
  SharedContactPayload,
} from './lib/shared-contact'
export { MESSAGE_STATUS_META, getMediaPlaceholder } from './lib/message-meta'
export {
  MESSAGE_STATUSES,
  MESSAGE_TYPES,
  isMessageDirection,
  isMessageStatus,
  isMessageType,
} from './model/types'
export type {
  MessageAttachmentRow,
  MessageDirection,
  MessageReactionRow,
  MessageRow,
  MessageRowWithAttachments,
  MessageStatus,
  MessageType,
} from './model/types'
