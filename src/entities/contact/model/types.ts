import type { Tables } from '@/api/types'

export type ContactRow = Tables<'contacts'>

export type ContactWithChannels = ContactRow & {
  contact_channels: Array<{
    id: string
    channel_type: string
    external_name: string | null
  }>
}
