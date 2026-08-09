import type { ContactListItem } from '@/entities/contact'
import type { DuplicateContact } from '../api/contact-merges'

/**
 * The scalar fields a merge may overwrite on the survivor.
 *
 * The same allowlist exists in `public.merge_contacts`, which raises rather
 * than trusting this one — the client chooses which VALUE wins, never which
 * column. This copy is here so the picker can only build a legal payload.
 */
export const MERGE_FIELD_KEYS = [
  'name',
  'email',
  'owner_id',
  'status',
  'avatar_url',
  'source',
] as const
export type MergeFieldKey = (typeof MERGE_FIELD_KEYS)[number]

/**
 * One side of a merge, normalized.
 *
 * Two entry points feed the dialog — a duplicate group and a directory
 * multi-select — and they carry different row shapes. Normalizing here keeps
 * the dialog from branching on where it was opened from.
 */
export type MergeCandidate = {
  id: string
  displayName: string | null
  name: string | null
  /**
   * Never merged — the merge unions `contact_phones` and re-syncs the column
   * itself. Carried so the survivor radio can tell two same-named contacts
   * apart, which is exactly the situation a duplicate list puts you in.
   */
  phone: string | null
  email: string | null
  avatarUrl: string | null
  status: string
  source: string | null
  ownerId: string | null
  tags: Array<string>
  lastSeenAt: string | null
  conversationCount: number
}

export function mergeCandidateFromDuplicate(
  contact: DuplicateContact,
): MergeCandidate {
  return {
    id: contact.id,
    displayName: contact.display_name,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    avatarUrl: contact.avatar_url,
    status: contact.status,
    source: contact.source,
    ownerId: contact.owner_id,
    tags: contact.tags,
    lastSeenAt: contact.last_seen_at,
    conversationCount: contact.conversation_count,
  }
}

export function mergeCandidateFromListItem(
  item: ContactListItem,
  conversationCount = 0,
): MergeCandidate {
  return {
    id: item.id,
    displayName: item.display_name,
    name: item.name,
    phone: item.phone,
    email: item.email,
    avatarUrl: item.avatar_url,
    status: item.status,
    source: item.source,
    ownerId: item.owner_id,
    tags: item.tags,
    lastSeenAt: item.last_seen_at,
    conversationCount,
  }
}

/**
 * Which contact the dialog pre-selects to keep.
 *
 * The one carrying more history, because moving fewer conversations is the
 * smaller change; then the more recently seen; then the lower id, which decides
 * nothing on the merits but makes the pre-selection stable. Two contacts with
 * no history and no last_seen_at must not swap places between renders.
 */
export function defaultSurvivorId(a: MergeCandidate, b: MergeCandidate): string {
  if (a.conversationCount !== b.conversationCount) {
    return a.conversationCount > b.conversationCount ? a.id : b.id
  }

  const aSeen = a.lastSeenAt ?? ''
  const bSeen = b.lastSeenAt ?? ''
  if (aSeen !== bSeen) return aSeen > bSeen ? a.id : b.id

  return a.id < b.id ? a.id : b.id
}

export type MergeConflict = {
  field: MergeFieldKey
  survivorValue: string | null
  mergedValue: string | null
}

const FIELD_READERS: Record<
  MergeFieldKey,
  (candidate: MergeCandidate) => string | null
> = {
  name: (c) => c.name,
  email: (c) => c.email,
  owner_id: (c) => c.ownerId,
  status: (c) => c.status,
  avatar_url: (c) => c.avatarUrl,
  source: (c) => c.source,
}

function normalize(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * Fields where both sides hold a value and the values differ.
 *
 * A field set on only one side is NOT a conflict: the merge fills the
 * survivor's blank from the loser, which is what anyone would expect and which
 * offering a choice would only obscure.
 */
export function mergeConflicts(
  survivor: MergeCandidate,
  merged: MergeCandidate,
): Array<MergeConflict> {
  const conflicts: Array<MergeConflict> = []

  for (const field of MERGE_FIELD_KEYS) {
    const survivorValue = normalize(FIELD_READERS[field](survivor))
    const mergedValue = normalize(FIELD_READERS[field](merged))

    if (survivorValue === null || mergedValue === null) continue
    if (survivorValue === mergedValue) continue

    conflicts.push({ field, survivorValue, mergedValue })
  }

  return conflicts
}

/**
 * The `p_fields` payload for one resolved merge.
 *
 * Only fields that actually change are emitted. `merge_contacts` leaves an
 * absent key alone, so keeping the survivor's value means sending nothing —
 * writing it back explicitly would bump updated_at over a no-op.
 */
export function mergeFields(
  survivor: MergeCandidate,
  merged: MergeCandidate,
  choices: Partial<Record<MergeFieldKey, 'survivor' | 'merged'>>,
): Partial<Record<MergeFieldKey, string | null>> {
  const fields: Partial<Record<MergeFieldKey, string | null>> = {}

  for (const field of MERGE_FIELD_KEYS) {
    const survivorValue = normalize(FIELD_READERS[field](survivor))
    const mergedValue = normalize(FIELD_READERS[field](merged))

    if (mergedValue === null) continue
    if (survivorValue === mergedValue) continue

    // Blank on the survivor: filled silently, no choice was offered.
    if (survivorValue === null) {
      fields[field] = mergedValue
      continue
    }

    if (choices[field] === 'merged') fields[field] = mergedValue
  }

  return fields
}
