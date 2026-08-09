import { m } from '@/paraglide/messages'
import type { LocalizedString } from '@/paraglide/runtime'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { List, ListItem } from '@astryxdesign/core/List'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { useToast } from '@astryxdesign/core/Toast'
import { useMemo, useState } from 'react'
import type { MergeFieldKey } from '../api/contact-merges'
import {
  isConversationConflictError,
  isNotAdminError,
} from '../api/contact-merges'
import {
  useContactMergeChildren,
  useMergeContacts,
} from '../hooks/use-contact-merges'
import type { MergeCandidate } from '../model/merge-candidate'
import {
  defaultSurvivorId,
  mergeConflicts,
  mergeFields,
} from '../model/merge-candidate'

const FIELD_LABELS: Record<MergeFieldKey, () => string> = {
  name: () => m.contacts_merge_field_name(),
  email: () => m.contacts_merge_field_email(),
  owner_id: () => m.contacts_merge_field_owner(),
  status: () => m.contacts_merge_field_status(),
  avatar_url: () => m.contacts_merge_field_avatar(),
  source: () => m.contacts_merge_field_source(),
}

type Props = {
  workspaceId: string
  /** Null closes the dialog; a pair opens it for those two contacts. */
  contacts: [MergeCandidate, MergeCandidate] | null
  onOpenChange: (open: boolean) => void
  /** Fired after a successful merge, for the caller to clear its selection. */
  onMerged: () => void
}

function candidateLabel(candidate: MergeCandidate): string {
  return candidate.displayName?.trim() || m.contact_unnamed()
}

/**
 * Choose, then commit.
 *
 * One dialog with two steps rather than a confirmation layered over a picker:
 * Astryx's Dialog guidance is explicit that dialogs must not nest, and
 * AlertDialog takes a plain string description and could not hold the picker
 * anyway. The separation that matters — deciding and committing are different
 * acts — survives as two steps inside one surface.
 *
 * `purpose="form"` because a backdrop click must not discard a half-made
 * choice.
 */
export function MergeContactsDialog({
  workspaceId,
  contacts,
  onOpenChange,
  onMerged,
}: Props) {
  const showToast = useToast()
  const merge = useMergeContacts(workspaceId)

  const [survivorId, setSurvivorId] = useState<string | null>(null)
  const [choices, setChoices] = useState<
    Partial<Record<MergeFieldKey, 'survivor' | 'merged'>>
  >({})
  const [isConfirming, setIsConfirming] = useState(false)
  const [conflictError, setConflictError] = useState(false)

  // Derived rather than stored, so reopening the dialog on a different pair
  // cannot leave the previous pair's survivor selected.
  const pairKey = contacts ? `${contacts[0].id}:${contacts[1].id}` : null
  const [seenPairKey, setSeenPairKey] = useState<string | null>(null)
  if (pairKey !== seenPairKey) {
    setSeenPairKey(pairKey)
    setSurvivorId(contacts ? defaultSurvivorId(contacts[0], contacts[1]) : null)
    setChoices({})
    setIsConfirming(false)
    setConflictError(false)
  }

  const survivor = contacts?.find((c) => c.id === survivorId) ?? null
  const merged = contacts?.find((c) => c.id !== survivorId) ?? null

  const children = useContactMergeChildren(
    workspaceId,
    merged?.id ?? '',
    contacts !== null,
  )

  const conflicts = useMemo(
    () => (survivor && merged ? mergeConflicts(survivor, merged) : []),
    [survivor, merged],
  )

  const fields = useMemo(
    () => (survivor && merged ? mergeFields(survivor, merged, choices) : {}),
    [survivor, merged, choices],
  )

  if (!contacts || !survivor || !merged) return null

  // Only what the picker actually overwrites — a field the survivor had blank
  // is filled, not replaced, and calling that destruction would be theatre.
  const overrides = conflicts.filter(
    (conflict) => choices[conflict.field] === 'merged',
  )

  // count_contact_merge_children reports what is currently attached to the
  // losing contact, not what merge_contacts will actually leave attached to
  // the survivor. For conversations, notes and channels those are the same
  // number — every row moves unconditionally. Phones are the exception:
  // merge_contacts silently drops any of the loser's phone rows whose digits
  // the survivor already holds (contact_phones_contact_digits_key), so
  // phone_count can overstate what the survivor gains. Rather than repeat a
  // count this sentence cannot back up, the phone clause is left out of the
  // "moving to X" summary entirely.
  const counts = children.data
  const movesSummary = counts
    ? [
        counts.conversation_count > 0 &&
          m.contacts_merge_moves_conversations({
            count: counts.conversation_count,
          }),
        counts.channel_count > 0 &&
          m.contacts_merge_moves_channels({ count: counts.channel_count }),
        counts.note_count > 0 &&
          m.contacts_merge_moves_notes({ count: counts.note_count }),
      ]
        .filter((part): part is LocalizedString => typeof part === 'string')
        .join(' · ')
    : ''

  function confirmMerge() {
    if (merge.isPending || !survivor || !merged) return

    merge.mutate(
      { survivorId: survivor.id, mergedId: merged.id, fields },
      {
        onError: (error) => {
          if (isConversationConflictError(error)) {
            setConflictError(true)
            setIsConfirming(false)
            return
          }
          showToast({
            body: isNotAdminError(error)
              ? m.contacts_merge_error_not_admin()
              : m.contacts_merge_error(),
            type: 'error',
          })
          onOpenChange(false)
        },
        onSuccess: () => {
          showToast({ body: m.contacts_merged_toast(), type: 'info' })
          onOpenChange(false)
          onMerged()
        },
      },
    )
  }

  return (
    <Dialog isOpen onOpenChange={onOpenChange} purpose="form" width={560}>
      <DialogHeader
        title={
          isConfirming ? m.contacts_merge_confirm_title() : m.contacts_merge_title()
        }
        subtitle={isConfirming ? undefined : m.contacts_merge_subtitle()}
        onOpenChange={onOpenChange}
        startContent={
          isConfirming ? (
            <Button
              label={m.contacts_merge_back()}
              variant="ghost"
              size="sm"
              onClick={() => setIsConfirming(false)}
            />
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4 px-4 py-4">
        {conflictError ? (
          <Banner
            status="error"
            title={m.contacts_merge_clash_title()}
            description={m.contacts_merge_clash_body({
              channel: candidateLabel(merged),
            })}
          />
        ) : isConfirming ? (
          <>
            {/* Status is "warning", not "error": nothing has gone wrong here.
              This is the last chance to back out of an irreversible action,
              which is a caution, not a failure. The clash banner above is the
              one genuine error in this dialog. */}
            <Banner
              status="warning"
              title={m.contacts_merge_confirm_irreversible()}
              description={m.contacts_merge_confirm_body({
                merged: candidateLabel(merged),
                survivor: candidateLabel(survivor),
              })}
            />

            {movesSummary ? (
              <p className="text-secondary text-xs">
                {m.contacts_merge_confirm_moves({
                  survivor: candidateLabel(survivor),
                  summary: movesSummary,
                })}
              </p>
            ) : null}

            {/* Omitted entirely when nothing is overwritten: inventing danger
                where there is none teaches people to click through it.
                List/ListItem rather than a hand-rolled <ul>: each row states
                one already-self-describing sentence (the field name is
                interpolated into the message itself), so no separate label
                slot is needed beyond List's own marker and spacing. */}
            {overrides.length > 0 ? (
              <List listStyle="disc" density="compact">
                {overrides.map((override) => (
                  <ListItem
                    key={override.field}
                    label={m.contacts_merge_confirm_override({
                      field: FIELD_LABELS[override.field](),
                      before: override.survivorValue ?? '',
                      after: override.mergedValue ?? '',
                    })}
                  />
                ))}
              </List>
            ) : null}
          </>
        ) : (
          <>
            <RadioList
              label={m.contacts_merge_keep_label()}
              value={survivor.id}
              onChange={setSurvivorId}
            >
              {contacts.map((candidate) => (
                <RadioListItem
                  key={candidate.id}
                  value={candidate.id}
                  label={candidateLabel(candidate)}
                  // Two duplicates very often share a name — that is why they
                  // are in this list — so the radio needs something else to
                  // tell them apart.
                  description={candidate.phone ?? candidate.email ?? undefined}
                  startContent={
                    <Avatar
                      size="sm"
                      name={candidateLabel(candidate)}
                      src={candidate.avatarUrl ?? undefined}
                    />
                  }
                />
              ))}
            </RadioList>

            {conflicts.length === 0 ? (
              <p className="text-secondary text-xs">
                {m.contacts_merge_no_conflicts()}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {conflicts.map((conflict) => (
                  <RadioList
                    key={conflict.field}
                    label={FIELD_LABELS[conflict.field]()}
                    orientation="horizontal"
                    size="sm"
                    value={choices[conflict.field] ?? 'survivor'}
                    onChange={(value) =>
                      setChoices((current) => ({
                        ...current,
                        [conflict.field]: value === 'merged' ? 'merged' : 'survivor',
                      }))
                    }
                  >
                    <RadioListItem
                      value="survivor"
                      label={conflict.survivorValue ?? m.contacts_merge_value_empty()}
                    />
                    <RadioListItem
                      value="merged"
                      label={conflict.mergedValue ?? m.contacts_merge_value_empty()}
                    />
                  </RadioList>
                ))}
              </div>
            )}

            <p className="text-secondary text-xs">
              {m.contacts_merge_always_kept()}
            </p>
          </>
        )}
      </div>

      <div className="border-border flex shrink-0 justify-end gap-2 border-t px-4 py-3">
        <Button
          label={m.common_cancel()}
          variant="ghost"
          onClick={() => onOpenChange(false)}
        />
        {conflictError ? null : isConfirming ? (
          <Button
            label={m.contacts_merge_confirm_action()}
            variant="destructive"
            onClick={confirmMerge}
            isLoading={merge.isPending}
          />
        ) : (
          <Button
            label={m.contacts_merge_continue()}
            variant="primary"
            onClick={() => setIsConfirming(true)}
          />
        )}
      </div>
    </Dialog>
  )
}
