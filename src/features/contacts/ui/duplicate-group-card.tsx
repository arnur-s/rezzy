import { listItemStyle } from '@/components/list'
import {
  ContactStatusChip,
  contactListDisplayName,
  isContactStatus,
} from '@/entities/contact'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import type {
  DuplicateGroup,
  DuplicateMatchReason,
} from '../api/contact-merges'

const REASON_LABELS: Record<DuplicateMatchReason, () => string> = {
  phone: () => m.contacts_duplicates_reason_phone(),
  channel: () => m.contacts_duplicates_reason_channel(),
  email: () => m.contacts_duplicates_reason_email(),
}

type Props = {
  group: DuplicateGroup
  workspaceId: string
  /** Owner/admin only: the RPC behind the action refuses anyone else. */
  canMerge: boolean
  onMerge: () => void
}

/**
 * One set of contacts that share an identity key.
 *
 * Not Card-wrapped: `DESIGN.md` reserves cards, and a group is a small stack of
 * list rows under a header, inside a pane that is already the containing
 * surface.
 */
export function DuplicateGroupCard({
  group,
  workspaceId,
  canMerge,
  onMerge,
}: Props) {
  return (
    <li className="border-border flex flex-col gap-1 border-b px-2 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-primary text-xs font-medium">
            {REASON_LABELS[group.match_reason]()}
          </span>
          <span className="text-secondary shrink-0 text-xs tabular-nums">
            {m.contacts_duplicates_group_size({ count: group.contact_count })}
          </span>
        </div>
        {canMerge ? (
          <Button
            label={m.contacts_duplicates_merge_action()}
            size="sm"
            variant="secondary"
            // Exactly two at a time: the picker is a two-column comparison.
            isDisabled={group.contact_count !== 2}
            onClick={onMerge}
          />
        ) : null}
      </div>

      <ul className="flex flex-col gap-0.5">
        {group.contacts.map((contact) => (
          <li
            key={contact.id}
            className={cn(
              'relative flex items-center gap-3',
              listItemStyle.md,
              'px-3 py-2',
              listItemStyle.transition,
              'hover:bg-primary/4 focus-within:bg-primary/4',
            )}
          >
            <Avatar
              size="sm"
              name={contactListDisplayName(contact.display_name)}
              src={contact.avatar_url ?? undefined}
            />
            <div className="min-w-0 flex-1">
              <Link
                to="/workspaces/$id/contacts/$contactId"
                params={{ id: workspaceId, contactId: contact.id }}
                className={cn(
                  'text-primary block truncate text-base font-medium outline-none',
                  'after:absolute after:inset-0 after:rounded-lg after:content-[""]',
                  'focus-visible:after:ring-accent focus-visible:after:ring-2 focus-visible:after:ring-inset',
                )}
              >
                {contactListDisplayName(contact.display_name)}
              </Link>
              {contact.phone?.trim() || contact.email?.trim() ? (
                <p className="text-secondary truncate text-xs">
                  {contact.phone?.trim() || contact.email?.trim()}
                </p>
              ) : null}
            </div>
            {isContactStatus(contact.status) ? (
              <ContactStatusChip status={contact.status} />
            ) : null}
          </li>
        ))}
      </ul>
    </li>
  )
}
