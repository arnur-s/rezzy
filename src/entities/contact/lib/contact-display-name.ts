import { m } from '@/paraglide/messages'
import type { ContactChannelSummary } from '../model/types'

function firstNonBlank(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * The name a contact is shown under.
 *
 * Most contacts in this product are created by an inbound message and have no
 * `name` at all — they are identified by the handle on the channel they wrote
 * from. Falling straight through to a placeholder would render a directory of
 * identical "Unnamed contact" rows, so the handle is tried first.
 *
 * This mirrors the `display_name` expression in `search_workspace_contacts`,
 * which is what name sorts order by. The list gets that value from the server
 * and does not call this; the detail page, which loads full channel rows, does.
 * Keep the two in step: printing one string while having sorted by another is
 * the bug this pairing exists to prevent.
 *
 * The placeholder is applied last and never sorted on, because it is localized
 * and would otherwise reorder the list per locale.
 */
export function contactDisplayName(contact: {
  name: string | null
  contact_channels?: Array<Pick<ContactChannelSummary, 'external_name'>>
}): string {
  return (
    firstNonBlank(contact.name) ??
    contact.contact_channels
      ?.map((channel) => firstNonBlank(channel.external_name))
      .find((handle): handle is string => handle !== null) ??
    m.contact_unnamed()
  )
}

/** The same fallback for a directory row, whose display name is server-computed. */
export function contactListDisplayName(displayName: string | null): string {
  return firstNonBlank(displayName) ?? m.contact_unnamed()
}
