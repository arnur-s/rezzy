import { m } from '@/paraglide/messages'

type ErrorCode = 'CHANNEL_INACTIVE' | string | null | undefined

export function mapDatabaseError(error: ErrorCode): Error {
  switch (error) {
    case 'CHANNEL_INACTIVE':
      return new Error(m.inbox_channel_inactive_error())

    default:
      return new Error(error ?? m.common_unknown_error())
  }
}
