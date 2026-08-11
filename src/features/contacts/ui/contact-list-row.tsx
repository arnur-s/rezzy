import { listItemStyle } from '@/components/list'
import type { ContactListItem } from '@/entities/contact'
import {
  ContactStatusChip,
  contactListDisplayName,
  isContactStatus,
} from '@/entities/contact'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format-date'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import type { DropdownMenuOption } from '@astryxdesign/core/DropdownMenu'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import { Link } from '@tanstack/react-router'
import { CONTACT_DATE_FORMAT } from '../model/date-format'

type Props = {
  contact: ContactListItem
  workspaceId: string
  ownerName: string | null
  menuItems: Array<DropdownMenuOption>
  /**
   * Row selection for a two-at-a-time merge pick. Undefined hides the
   * checkbox entirely, so the row renders exactly as it did before selection
   * existed — which is what it still does for a member who cannot merge.
   */
  selection?: {
    isSelected: boolean
    onToggle: () => void
  }
}

/**
 * One person in the directory.
 *
 * The row is NOT a button. The inbox wraps its conversation rows in
 * `<button role="option">`, which is fine there because those rows contain
 * nothing clickable — but a contact row carries an action menu, and a button
 * inside a button is invalid HTML: browsers reparent it, screen readers announce
 * it unpredictably, and it forces `stopPropagation` patching to stop the inner
 * control from firing the outer one.
 *
 * Instead the primary target is a `Link` stretched over the row by an absolutely
 * positioned `::after`, and the menu is its SIBLING, raised above that
 * pseudo-element. Both are natively focusable, tab order is link then menu, and
 * no event plumbing is involved — clicking the menu cannot navigate because the
 * menu is not inside the link.
 */
export function ContactListRow({
  contact,
  workspaceId,
  ownerName,
  menuItems,
  selection,
}: Props) {
  const displayName = contactListDisplayName(contact.display_name)
  const primaryContact =
    contact.phone?.trim() ||
    contact.email?.trim() ||
    contact.channel_types[0] ||
    null

  return (
    <li
      className={cn(
        'group relative flex items-center gap-3',
        listItemStyle.md,
        'px-3 py-2.5',
        listItemStyle.transition,
        'hover:bg-primary/4 focus-within:bg-primary/4',
      )}
    >
      {/* Sibling of the link, lifted above the stretched pseudo-element —
          same reason the action menu below is. */}
      {selection ? (
        <div className="relative z-10 shrink-0">
          <CheckboxInput
            label={m.contacts_merge_select_contact({ name: displayName })}
            isLabelHidden
            size="sm"
            value={selection.isSelected}
            onChange={selection.onToggle}
          />
        </div>
      ) : null}

      <Avatar
        size="sm"
        name={displayName}
        src={contact.avatar_url ?? undefined}
      />

      <div className="min-w-0 flex-1">
        <Link
          to="/workspaces/$id/contacts/$contactId"
          params={{ id: workspaceId, contactId: contact.id }}
          // Stretches the hit area over the whole row without wrapping the row's
          // other controls. The ring is drawn on the row so focus is visible at
          // row scale rather than around the text.
          className={cn(
            'text-primary block truncate text-base font-medium outline-none',
            'after:absolute after:inset-0 after:rounded-lg after:content-[""]',
            'focus-visible:after:ring-accent focus-visible:after:ring-2 focus-visible:after:ring-inset',
          )}
        >
          {displayName}
        </Link>
        {primaryContact ? (
          <p className="text-secondary truncate text-sm">{primaryContact}</p>
        ) : null}
      </div>

      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {isContactStatus(contact.status) ? (
          <ContactStatusChip status={contact.status} />
        ) : null}
        {ownerName ? (
          <span className="text-secondary max-w-32 truncate text-sm">
            {ownerName}
          </span>
        ) : null}
        <span className="text-secondary w-24 shrink-0 text-right text-sm">
          {contact.last_seen_at
            ? formatDate(contact.last_seen_at, CONTACT_DATE_FORMAT)
            : m.contacts_never_contacted()}
        </span>
      </div>

      {/* Sibling of the link, lifted above the stretched pseudo-element. */}
      <div className="relative z-10 shrink-0">
        <MoreMenu
          label={m.contacts_row_actions()}
          size="sm"
          items={menuItems}
        />
      </div>
    </li>
  )
}
