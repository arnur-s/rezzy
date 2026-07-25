import { m } from '@/paraglide/messages'
import { PresentableError } from './presentable-error'

type ErrorCode = 'CHANNEL_INACTIVE' | string | null | undefined

/**
 * Known codes become a {@link PresentableError} carrying actionable, localized
 * copy the UI can show as-is. Anything unrecognized stays a plain `Error` that
 * still carries the raw database text — useful for logging, but a signal to the
 * UI to fall back to curated copy rather than surface Postgres internals.
 */
export function mapDatabaseError(error: ErrorCode): Error {
  switch (error) {
    case 'CHANNEL_INACTIVE':
      return new PresentableError(m.inbox_channel_inactive_error())

    default:
      return new Error(error ?? m.common_unknown_error())
  }
}
