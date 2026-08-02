export { CHANNEL_META } from './lib/channel-meta'
export { hasActiveChannel } from './lib/channel-readiness'
export { PLATFORM_META } from './lib/platform'
export {
  REACTION_CAPABILITIES,
  SUPPORTED_REACTIONS,
  getReactionCapabilities,
  supportsReactionEmoji,
} from './model/reaction-capabilities'
export type { ReactionCapabilities } from './model/reaction-capabilities'
export { CHANNEL_TYPES, isChannelType } from './model/types'
export { ChannelStatusBadge } from './ui/channel-status-badge'
export { ChannelTypeIcon } from './ui/channel-type-icon'
export { PlatformIcon } from './ui/platform-icon'
export type { Channel, ChannelType, TelegramCredentials } from './model/types'
