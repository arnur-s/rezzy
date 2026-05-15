import type { Tables } from '@/api/types'

export type Channel = Tables<'channels'>

export const CHANNEL_TYPES = [
  'telegram',
  'instagram',
  'whatsapp',
  'email',
] as const

export type ChannelType = (typeof CHANNEL_TYPES)[number]

export type TelegramCredentials = {
  bot_token: string
  webhook_secret?: string
}

export function isChannelType(value: string): value is ChannelType {
  return (CHANNEL_TYPES as ReadonlyArray<string>).includes(value)
}
