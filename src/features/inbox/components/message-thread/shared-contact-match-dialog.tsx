import type { ContactMatch } from '@/features/contacts'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'

type Props = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** The shared card's name, so the user can compare against the candidates. */
  sharedName: string | null
  matches: Array<ContactMatch>
  onOpenContact: (contactId: string) => void | Promise<void>
  onCreateNew: () => void
}

function matchReasonLabel(match: ContactMatch): string {
  if (match.match_reason === 'channel') {
    return m.inbox_shared_contact_reason_channel()
  }
  if (match.match_reason === 'email') {
    return m.inbox_shared_contact_reason_email()
  }
  return m.inbox_shared_contact_reason_phone()
}

/**
 * The "review match" step: several credible contacts carry this identity, so
 * the product refuses to pick one. Nothing here mutates — every option is
 * either navigation or a hand-off to the creation form.
 */
export function SharedContactMatchDialog({
  isOpen,
  onOpenChange,
  sharedName,
  matches,
  onOpenContact,
  onCreateNew,
}: Props) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={420}>
      <DialogHeader
        title={m.inbox_shared_contact_review_title()}
        subtitle={
          sharedName
            ? m.inbox_shared_contact_review_subtitle({ name: sharedName })
            : undefined
        }
        onOpenChange={onOpenChange}
      />
      <div className="flex flex-col gap-4 px-4 pt-2 pb-6">
        {/* A list of choices, not a list of cards: rows edge to edge, one
          decision per row. */}
        <ul className="border-border/60 divide-border/60 -mx-4 divide-y border-y">
          {matches.map((match) => (
            <li key={match.id}>
              <button
                type="button"
                onClick={() => void onOpenContact(match.id)}
                // Same hover tint and focus ring the contact directory rows
                // use, so a row of the same kind reads the same way.
                className="hover:bg-primary/4 focus-visible:ring-accent flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none"
              >
                <Avatar
                  size="sm"
                  name={match.name ?? ''}
                  src={match.avatar_url ?? undefined}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-primary truncate text-base font-medium">
                    {match.name?.trim() || m.contact_unnamed()}
                  </span>
                  <span className="text-secondary truncate text-sm">
                    {match.phone ?? match.email ?? matchReasonLabel(match)}
                  </span>
                </span>
                <span className="text-secondary shrink-0 text-sm">
                  {matchReasonLabel(match)}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            label={m.common_cancel()}
            variant="ghost"
            onClick={() => onOpenChange(false)}
          />
          <Button
            label={m.inbox_shared_contact_review_none()}
            variant="secondary"
            onClick={onCreateNew}
          />
        </div>
      </div>
    </Dialog>
  )
}
