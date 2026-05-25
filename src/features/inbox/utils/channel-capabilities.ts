import type { ChannelType } from '@/entities/channel'

type ChannelCapabilities = {
  acceptedMimeTypes: string
}

export const CHANNEL_CAPABILITIES: Record<ChannelType, ChannelCapabilities> = {
  telegram: {
    acceptedMimeTypes: 'image/*,video/*,audio/*,application/pdf',
  },
  instagram: {
    acceptedMimeTypes: 'image/*,video/*',
  },
  whatsapp: {
    acceptedMimeTypes: 'image/*,video/*,audio/*,application/pdf',
  },
  email: {
    acceptedMimeTypes: 'image/*,video/*,application/pdf,application/zip,text/plain',
  },
}
