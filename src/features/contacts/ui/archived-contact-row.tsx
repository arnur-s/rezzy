import { listItemStyle } from '@/components/list'
import { contactListDisplayName } from '@/entities/contact'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format-date'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Button } from '@astryxdesign/core/Button'
import type { ArchivedContact } from '../api/contacts'
import { CONTACT_DATE_FORMAT } from '../model/date-format'

type Props = {
  contact: ArchivedContact
  onRestore: () => void
  isRestoring: boolean
}

/**
 * One archived contact, and the way back.
 *
 * Deliberately not a `ContactListRow`: that row's whole surface is a stretched
 * `Link` to the detail page, and an archived contact has no detail page to link
 * to — `getWorkspaceContact` resolves to null under the SELECT policy, so the
 * row would navigate straight into the not-found state. What an archived
 * contact has is an identity to recognise it by and a Restore button.
 */
export function ArchivedContactRow({ contact, onRestore, isRestoring }: Props) {
  const displayName = contactListDisplayName(contact.display_name)
  const primaryContact =
    contact.phone?.trim() ||
    contact.email?.trim() ||
    contact.channel_types[0] ||
    null
  // Non-null only when this row was merged rather than archived on its own —
  // `restore_contact` refuses that case with CONTACT_IS_MERGED, so the row
  // names the survivor instead of offering a button that can only error.
  const isMerged = contact.merged_into_id !== null

  return (
    <li
      className={cn(
        'relative flex items-center gap-3',
        listItemStyle.md,
        'px-3 py-2.5',
        listItemStyle.transition,
        'hover:bg-primary/4 focus-within:bg-primary/4',
      )}
    >
      <Avatar
        size="sm"
        name={displayName}
        src={contact.avatar_url ?? undefined}
      />

      <div className="min-w-0 flex-1">
        <p className="text-primary truncate text-base font-medium">
          {displayName}
        </p>
        {primaryContact ? (
          <p className="text-secondary truncate text-xs">{primaryContact}</p>
        ) : null}
      </div>

      {/* What restoring brings back, and when it went away. Hidden on phones,
          where the name and the Restore button are what matter. A merged row
          has nothing to restore, so it names its survivor here instead. */}
      <div className="text-secondary hidden shrink-0 items-center gap-3 text-xs sm:flex">
        {isMerged ? (
          <span>
            {m.contacts_archived_merged_into({
              name: contact.merged_into_name ?? '',
            })}
          </span>
        ) : (
          <>
            {contact.conversation_count > 0 ? (
              <span>
                {m.contacts_archived_conversations({
                  count: contact.conversation_count,
                })}
              </span>
            ) : null}
            <span>{formatDate(contact.deleted_at, CONTACT_DATE_FORMAT)}</span>
          </>
        )}
      </div>

      <div className="shrink-0">
        {isMerged ? null : (
          <Button
            label={m.contact_restore_action()}
            size="sm"
            variant="ghost"
            onClick={onRestore}
            isLoading={isRestoring}
          />
        )}
      </div>
    </li>
  )
}
