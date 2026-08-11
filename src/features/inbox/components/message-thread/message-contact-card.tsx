import type { ContactDetail } from '@/entities/contact'
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
  useContactPhones,
} from '@/features/contacts'
import { useWorkspacePhoneRegion } from '@/features/workspaces/hooks/use-workspace-phone-region'
import { cn } from '@/lib/cn'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import type { PhoneRegionContext } from '@/lib/phone-identity'
import {
  formatPhoneForDisplay,
  formatPhoneForStorage,
  phoneDigits,
  phoneLookupDigits,
  phoneNumbersMatch,
  regionFromExplicitNumber,
} from '@/lib/phone-identity'
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
export function MessageContactCard({
  contacts,
  isOutbound,
  workspaceId,
}: Props) {
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
 *   in the CRM, but     Open contact + Add to contact, which opens that
 *   missing a number    contact's form with the missing numbers filled in
 *   several candidates  Review match    (asks, never guesses)
 *   nothing to match on Copy details
 *   country unknown     Copy details + Create, and says why it could not check
 *
 * Receiving one of these never writes anything: no contact is created, no
 * number is added, and no toast is raised, until the user asks for it.
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
  const [isExtending, setIsExtending] = useState(false)
  /**
   * The contact whose form is open to receive numbers off this card, with the
   * numbers as they stood when the user asked for them.
   *
   * Held together, and frozen, because saving invalidates the contact's phone
   * set: recomputing the missing numbers mid-dialog would empty the rows the
   * user is looking at.
   */
  const [extendTarget, setExtendTarget] = useState<{
    contact: ContactDetail
    phones: Array<string>
  } | null>(null)
  const queryClient = useQueryClient()

  // A number written without a country code is read under the workspace's
  // region, or under a country stated by a sibling number on the same card —
  // never under a hardcoded default. With neither, it stays ambiguous and is
  // left out of the lookup entirely.
  const regionQuery = useWorkspacePhoneRegion(workspaceId)
  const workspaceRegion = regionQuery.data ?? null
  const regionContext: PhoneRegionContext = useMemo(
    () => ({
      hints: contact.phoneNumbers.map((phone) =>
        regionFromExplicitNumber(phone),
      ),
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
  const matchedContact =
    matches.find((entry) => entry.id === matchedContactId) ?? null
  // The matched contact's whole set, not just the primary the match reports:
  // "the contact already has this number" has to be true of every number it has.
  const matchedPhonesQuery = useContactPhones(
    workspaceId,
    matchedContactId ?? '',
  )

  /**
   * Numbers on this card that the matched contact does not carry.
   *
   * This is the case the CRM used to lose silently. A card can name a person by
   * two numbers while the contact record — opened from a conversation, or saved
   * before the second number existed — knows only one, and the card would then
   * offer to open a record it could see was incomplete.
   *
   * Compared through {@link phoneLookupDigits}, so a stored `+7 701 747 3004`
   * and a shared `+77017473004` are one number. A card number that cannot be
   * placed in a country is skipped: it can be neither compared with what the
   * contact has nor stored as something dialable, and the card already says so.
   */
  const missingPhones = useMemo(() => {
    const loaded = matchedPhonesQuery.data
    if (!matchedContactId || !loaded) return []
    // Nothing to compare against: no rows, and no match row to read a primary
    // from (a contact this card created itself). Saying "add" here would be a
    // guess, and the guess would duplicate a number.
    if (loaded.length === 0 && !matchedContact) return []

    const known = new Set<string>()
    const remember = (value: string | null) => {
      const trimmed = value?.trim()
      if (!trimmed) return
      // The literal digits as well as the resolved forms, so a stored number
      // that cannot be placed still shadows an identical one on the card.
      known.add(phoneDigits(trimmed))
      for (const digits of phoneLookupDigits(trimmed, regionContext)) {
        known.add(digits)
      }
    }
    for (const entry of loaded) remember(entry.phone)
    remember(matchedContact?.phone ?? null)

    const missing: Array<string> = []
    for (const phone of contact.phoneNumbers) {
      const cardDigits = phoneLookupDigits(phone, regionContext)
      if (cardDigits.length === 0) continue
      if (cardDigits.some((digits) => known.has(digits))) continue
      const stored = formatPhoneForStorage(phone, regionContext)
      if (
        missing.some((existing) =>
          phoneNumbersMatch(existing, stored, regionContext),
        )
      ) {
        continue
      }
      missing.push(stored)
    }
    return missing
  }, [
    contact.phoneNumbers,
    matchedContact,
    matchedContactId,
    matchedPhonesQuery.data,
    regionContext,
  ])

  /**
   * Reads a matched contact back, to check it is still there.
   *
   * A match can be stale — someone else deleted the contact since the lookup
   * ran — and acting on it would be the card blaming the user for its own stale
   * answer. Instead the lookup is dropped, the local "just created" id with it,
   * and the card falls back to offering a create.
   */
  const resolveMatch = async (contactId: string) => {
    const stillThere = await getWorkspaceContact({ workspaceId, contactId })
    if (stillThere) return stillThere

    setCreatedContactId(null)
    setIsReviewOpen(false)
    await queryClient.invalidateQueries({
      queryKey: contactQueryKeys.matches(workspaceId),
    })
    showToast({ body: m.inbox_shared_contact_missing(), type: 'error' })
    return null
  }

  const openContact = async (contactId: string) => {
    if (isOpening) return
    setIsOpening(true)
    try {
      if (!(await resolveMatch(contactId))) return
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

  /**
   * Opens the matched contact's own form with the missing numbers already in
   * it. Deliberately not a direct write: the user sees which numbers are being
   * added to whom, and saves — the same bargain "Create contact" makes.
   */
  const addMissingPhones = async (contactId: string) => {
    if (isExtending || missingPhones.length === 0) return
    setIsExtending(true)
    try {
      const record = await resolveMatch(contactId)
      if (!record) return
      setExtendTarget({ contact: record, phones: missingPhones })
    } catch {
      showToast({ body: m.inbox_shared_contact_open_failed(), type: 'error' })
    } finally {
      setIsExtending(false)
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
          <span role="status" className={cn('text-sm', muted)}>
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
          <span role="status" className={cn('text-sm', muted)}>
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
      const openAction = (
        <Button
          label={m.inbox_shared_contact_open()}
          size="sm"
          variant="secondary"
          isLoading={isOpening}
          isDisabled={isOpening}
          onClick={() => void openContact(matchedContactId)}
        />
      )

      if (missingPhones.length === 0) return openAction

      // Said before it is offered: without the sentence, a second button beside
      // "Open contact" is a mystery, and the number it would add is one the
      // reader can already see two lines above.
      return (
        <>
          <span role="status" className={cn('text-sm', muted)}>
            {m.inbox_shared_contact_phones_missing()}
          </span>
          {openAction}
          <Button
            label={m.inbox_shared_contact_add_phones()}
            size="sm"
            variant="ghost"
            isLoading={isExtending}
            isDisabled={isExtending}
            onClick={() => void addMissingPhones(matchedContactId)}
          />
        </>
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
            <span key={email} className={cn('truncate text-sm', muted)}>
              {email}
            </span>
          ))}
          {contact.company ? (
            <span className={cn('truncate text-sm', muted)}>
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

      {/* The matched contact's own edit form, carrying the numbers this card
        knows and it does not. Mounted only once the record has been read back,
        so it never opens on a contact that has since been deleted. */}
      {extendTarget ? (
        <ContactFormDialog
          workspaceId={workspaceId}
          contact={extendTarget.contact}
          isOpen
          onOpenChange={(open) => {
            if (!open) setExtendTarget(null)
          }}
          additionalPhones={extendTarget.phones}
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
      <span className={cn('truncate text-sm', className)}>
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
