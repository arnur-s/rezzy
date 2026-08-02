import type { SharedContact } from '@/entities/message'
import {
  hasSharedContactIdentity,
  sharedContactToText,
} from '@/entities/message'
import {
  ContactFormDialog,
  contactIdentityFromSharedContact,
  contactQueryKeys,
  getWorkspaceContact,
  useContactMatches,
} from '@/features/contacts'
import { useWorkspacePhoneRegion } from '@/features/workspaces/hooks/use-workspace-phone-region'
import { cn } from '@/lib/cn'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import {
  formatPhoneForDisplay,
  formatPhoneForStorage,
  regionFromExplicitNumber,
} from '@/lib/phone-identity'
import type { PhoneRegionContext } from '@/lib/phone-identity'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { useToast } from '@astryxdesign/core/Toast'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CopyIcon, UserRoundIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SharedContactMatchDialog } from './shared-contact-match-dialog'

type Props = {
  contacts: Array<SharedContact>
  isOutbound: boolean
  /** The message's workspace: every lookup and every write stays inside it. */
  workspaceId: string
}

/** Shared contact-card rendering (one message may carry several cards). */
export function MessageContactCard({ contacts, isOutbound, workspaceId }: Props) {
  return (
    <div className="flex flex-col gap-2 p-0.5">
      {contacts.map((contact, index) => (
        <SharedContactCard
          // Cards come from an immutable message payload, so their position is
          // their identity; nothing reorders or is inserted between them.
          key={index}
          contact={contact}
          isOutbound={isOutbound}
          workspaceId={workspaceId}
        />
      ))}
    </div>
  )
}

/**
 * One shared contact, with the single action that makes sense for it:
 *
 *   unknown             Create contact  (opens the contact form, prefilled)
 *   already in the CRM  Open contact    (navigates to the contact)
 *   several candidates  Review match    (asks, never guesses)
 *   nothing to match on Copy details
 *   country unknown     Copy details + Create, and says why it could not check
 *
 * Receiving one of these never writes anything: no contact is created, and no
 * toast is raised, until the user asks for it.
 */
function SharedContactCard({
  contact,
  isOutbound,
  workspaceId,
}: {
  contact: SharedContact
  isOutbound: boolean
  workspaceId: string
}) {
  const navigate = useNavigate()
  const showToast = useToast()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isReviewOpen, setIsReviewOpen] = useState(false)
  /**
   * The contact this card created, held locally.
   *
   * The lookup is invalidated on create and will return the same id a moment
   * later, but "a moment later" is exactly the window in which the card would
   * otherwise offer to create the contact a second time.
   */
  const [createdContactId, setCreatedContactId] = useState<string | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const queryClient = useQueryClient()

  // A number written without a country code is read under the workspace's
  // region, or under a country stated by a sibling number on the same card —
  // never under a hardcoded default. With neither, it stays ambiguous and is
  // left out of the lookup entirely.
  const regionQuery = useWorkspacePhoneRegion(workspaceId)
  const workspaceRegion = regionQuery.data ?? null
  const regionContext: PhoneRegionContext = useMemo(
    () => ({
      hints: contact.phoneNumbers.map((phone) => regionFromExplicitNumber(phone)),
      workspaceRegion,
    }),
    [contact.phoneNumbers, workspaceRegion],
  )

  const lookup = useMemo(
    () => contactIdentityFromSharedContact(contact, { workspaceRegion }),
    [contact, workspaceRegion],
  )
  const canMatch = hasSharedContactIdentity(contact)
  // The card carries numbers, but none of them could be placed in a country, so
  // there is nothing safe to look up.
  const isUnplaceable =
    canMatch &&
    lookup.phoneDigits.length === 0 &&
    lookup.emails.length === 0 &&
    lookup.channelIdentities.length === 0
  const matchesQuery = useContactMatches(workspaceId, lookup)
  const matches = matchesQuery.data ?? []

  const name = contact.displayName
  const [primaryPhone, ...otherPhones] = contact.phoneNumbers
  const muted = isOutbound ? 'text-current/75' : 'text-primary/60'

  const matchedContactId =
    createdContactId ?? (matches.length === 1 ? matches[0].id : null)

  /**
   * Opens a matched contact, having first checked it is still there.
   *
   * A match can be stale — someone else deleted the contact since the lookup
   * ran — and navigating to a not-found page would be the card blaming the user
   * for its own stale answer. Instead the lookup is dropped, the local
   * "just created" id with it, and the card falls back to offering a create.
   */
  const openContact = async (contactId: string) => {
    if (isOpening) return
    setIsOpening(true)
    try {
      const stillThere = await getWorkspaceContact({ workspaceId, contactId })
      if (!stillThere) {
        setCreatedContactId(null)
        setIsReviewOpen(false)
        await queryClient.invalidateQueries({
          queryKey: contactQueryKeys.matches(workspaceId),
        })
        showToast({ body: m.inbox_shared_contact_missing(), type: 'error' })
        return
      }
      setIsReviewOpen(false)
      await navigate({
        to: '/workspaces/$id/contacts/$contactId',
        params: { id: workspaceId, contactId },
      })
    } catch {
      showToast({ body: m.inbox_shared_contact_open_failed(), type: 'error' })
    } finally {
      setIsOpening(false)
    }
  }

  const copy = (value: string, successMessage: string) => {
    void copyToClipboard(value).then((ok) =>
      showToast({
        body: ok ? successMessage : m.inbox_message_copy_failed(),
        type: ok ? 'info' : 'error',
      }),
    )
  }

  const copyDetailsAction = (
    <Button
      label={m.inbox_shared_contact_copy_details()}
      size="sm"
      variant="secondary"
      onClick={() =>
        copy(sharedContactToText(contact), m.inbox_shared_contact_copied())
      }
    />
  )

  const createAction = (
    <Button
      label={m.inbox_shared_contact_create()}
      size="sm"
      variant="secondary"
      onClick={() => setIsCreateOpen(true)}
    />
  )

  function renderAction() {
    // Nothing identifies this person, so there is nothing to look up and no
    // honest "create" to offer: a contact built from a name alone is a
    // duplicate waiting to happen. The details stay copyable.
    if (!canMatch) return copyDetailsAction

    // There IS a number, but it is written locally and no country could be
    // named for it. Saying "Create contact" here would imply the CRM was
    // checked and came back empty, which is not what happened — so the card
    // says what it could not do, and still lets the user act on the details.
    if (isUnplaceable) {
      return (
        <span className="flex flex-wrap items-center gap-2">
          <span role="status" className={cn('text-xs', muted)}>
            {m.inbox_shared_contact_region_unknown()}
          </span>
          {copyDetailsAction}
          {createAction}
        </span>
      )
    }

    // Deliberately not "Create contact" while the answer is unknown: an action
    // that changes under the pointer is worse than one that waits.
    if (matchesQuery.isPending) {
      return (
        <Button
          label={m.inbox_shared_contact_checking()}
          size="sm"
          variant="secondary"
          isLoading
          isDisabled
        />
      )
    }

    if (matchesQuery.isError) {
      return (
        <span className="flex flex-wrap items-center gap-2">
          <span role="status" className={cn('text-xs', muted)}>
            {m.inbox_shared_contact_lookup_failed()}
          </span>
          <Button
            label={m.common_retry()}
            size="sm"
            variant="ghost"
            onClick={() => void matchesQuery.refetch()}
            isLoading={matchesQuery.isRefetching}
          />
          {copyDetailsAction}
        </span>
      )
    }

    if (matchedContactId) {
      return (
        <Button
          label={m.inbox_shared_contact_open()}
          size="sm"
          variant="secondary"
          isLoading={isOpening}
          isDisabled={isOpening}
          onClick={() => void openContact(matchedContactId)}
        />
      )
    }

    if (matches.length > 1) {
      return (
        <Button
          label={m.inbox_shared_contact_review()}
          size="sm"
          variant="secondary"
          onClick={() => setIsReviewOpen(true)}
        />
      )
    }

    return createAction
  }

  return (
    <div
      // Grouped so the action is announced with the person it acts on: several
      // cards in one message would otherwise be several identical buttons.
      role="group"
      aria-label={
        name
          ? m.inbox_shared_contact_group({ name })
          : m.inbox_message_type_contact()
      }
      className="flex flex-col gap-2 text-sm"
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full',
            isOutbound ? 'bg-current/15' : 'bg-primary/10',
          )}
        >
          <UserRoundIcon className="size-4" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">
            {name ?? m.inbox_shared_contact_unnamed()}
          </span>
          {primaryPhone ? (
            <PhoneLine
              phone={primaryPhone}
              className={muted}
              regionContext={regionContext}
              onCopy={() =>
                copy(primaryPhone, m.inbox_shared_contact_phone_copied())
              }
            />
          ) : null}
          {otherPhones.map((phone) => (
            <PhoneLine
              key={phone}
              phone={phone}
              className={muted}
              regionContext={regionContext}
              onCopy={() => copy(phone, m.inbox_shared_contact_phone_copied())}
            />
          ))}
          {contact.emails.map((email) => (
            <span key={email} className={cn('truncate text-xs', muted)}>
              {email}
            </span>
          ))}
          {contact.company ? (
            <span className={cn('truncate text-xs', muted)}>
              {contact.company}
            </span>
          ) : null}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">{renderAction()}</div>

      {/* Mounted only while open so a transcript of shared contacts does not
        carry a dialog per card. */}
      {isCreateOpen ? (
        <ContactFormDialog
          workspaceId={workspaceId}
          contact={null}
          isOpen
          onOpenChange={setIsCreateOpen}
          initialValues={{
            name: name ?? '',
            // Every number the card carries, primary first — the form persists
            // the whole set. E.164 where the country is known, so a number the
            // user saves matches this card (and the next one) on its next
            // lookup; a number whose country is not known is seeded as written,
            // for the user to complete.
            phones: contact.phoneNumbers.map((phone) => ({
              value: formatPhoneForStorage(phone, regionContext),
            })),
            email: contact.emails[0] ?? '',
          }}
          // Stay in the conversation: this was started from a message, not from
          // the directory.
          onCreated={(created) => setCreatedContactId(created.id)}
        />
      ) : null}

      {isReviewOpen ? (
        <SharedContactMatchDialog
          isOpen
          onOpenChange={setIsReviewOpen}
          sharedName={name}
          matches={matches}
          onOpenContact={openContact}
          onCreateNew={() => {
            setIsReviewOpen(false)
            setIsCreateOpen(true)
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * A phone number with its own copy control.
 *
 * The bubble disables text selection on touch (press-and-hold belongs to the
 * message menu there), so a number the user cannot select has to be copyable
 * some other way.
 */
function PhoneLine({
  phone,
  className,
  regionContext,
  onCopy,
}: {
  phone: string
  className: string
  regionContext: PhoneRegionContext
  onCopy: () => void
}) {
  return (
    <span className="flex items-center gap-1">
      {/* Grouped only when the country is known; otherwise shown exactly as it
        arrived, rather than formatted as if we had placed it. */}
      <span className={cn('truncate text-xs', className)}>
        {formatPhoneForDisplay(phone, regionContext)}
      </span>
      <IconButton
        variant="ghost"
        size="sm"
        label={m.inbox_shared_contact_copy_phone()}
        icon={<CopyIcon className="size-3" />}
        onClick={onCopy}
      />
    </span>
  )
}
