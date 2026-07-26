import type { Channel } from '../model/types'

/**
 * Whether a workspace can receive customer conversations.
 *
 * `is_active` is the schema's connected state. The connect edge functions
 * validate credentials with the provider before inserting, and only ever insert
 * with `is_active: true`, so a failed connection leaves no row behind — there is
 * no pending or failed record to filter out here. Disconnecting flips the flag
 * and keeps the conversations.
 */
export function hasActiveChannel(
  channels: ReadonlyArray<Channel> | undefined,
): boolean {
  return channels?.some((channel) => channel.is_active) ?? false
}
