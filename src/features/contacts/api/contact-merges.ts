import { callRpc } from '@/utils/supabase-rpc'
import { z } from 'zod'

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

export const DUPLICATE_MATCH_REASONS = ['phone', 'channel', 'email'] as const
export type DuplicateMatchReason = (typeof DUPLICATE_MATCH_REASONS)[number]

/**
 * Hand-written rather than taken from the generated `Returns`: these arrive
 * inside a jsonb column, so the generator types the whole thing as `Json` and
 * knows nothing about the fields. Validating here means a shape change fails at
 * the boundary instead of three components later.
 */
const duplicateContactSchema = z.object({
  id: z.string(),
  /** What the row shows: the name, else the earliest channel handle. */
  display_name: z.string().nullable(),
  /** What a merge would write to `contacts.name`. Not the same thing. */
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  avatar_url: z.string().nullable(),
  status: z.string(),
  source: z.string().nullable(),
  owner_id: z.string().nullable(),
  tags: z.array(z.string()),
  last_seen_at: z.string().nullable(),
  conversation_count: z.number(),
})

export type DuplicateContact = z.infer<typeof duplicateContactSchema>

const duplicateGroupSchema = z.object({
  group_key: z.string(),
  match_reason: z.enum(DUPLICATE_MATCH_REASONS),
  contacts: z.array(duplicateContactSchema),
  contact_count: z.number(),
  total_count: z.number(),
})

export type DuplicateGroup = z.infer<typeof duplicateGroupSchema>

export type DuplicateGroupPage = {
  items: Array<DuplicateGroup>
  totalCount: number
}

/** Kept in step with the RPC's own clamp: least(greatest(p_limit, 1), 50). */
export const DUPLICATE_GROUPS_PAGE_SIZE = 20

export async function listDuplicateContactGroups({
  workspaceId,
  page,
  pageSize = DUPLICATE_GROUPS_PAGE_SIZE,
}: {
  workspaceId: string
  page: number
  pageSize?: number
}): Promise<DuplicateGroupPage> {
  const items = await callRpc(
    'list_duplicate_contact_groups',
    {
      p_workspace_id: workspaceId,
      p_limit: pageSize,
      p_offset: Math.max(page - 1, 0) * pageSize,
    },
    z.array(duplicateGroupSchema),
  )

  // total_count is repeated on every row; no rows means no duplicates.
  return { items, totalCount: items[0]?.total_count ?? 0 }
}

const mergeChildCountsSchema = z.object({
  conversation_count: z.number(),
  note_count: z.number(),
  phone_count: z.number(),
  channel_count: z.number(),
})

export type MergeChildCounts = z.infer<typeof mergeChildCountsSchema>

export async function countContactMergeChildren({
  workspaceId,
  contactId,
}: {
  workspaceId: string
  contactId: string
}): Promise<MergeChildCounts> {
  const rows = await callRpc(
    'count_contact_merge_children',
    { p_workspace_id: workspaceId, p_contact_id: contactId },
    z.array(mergeChildCountsSchema),
  )

  return (
    rows[0] ?? {
      conversation_count: 0,
      note_count: 0,
      phone_count: 0,
      channel_count: 0,
    }
  )
}

export type MergeContactsInput = {
  survivorId: string
  mergedId: string
  /** Only keys in {@link MERGE_FIELD_KEYS}; the RPC raises on anything else. */
  fields: Partial<Record<MergeFieldKey, string | null>>
}

export async function mergeContacts({
  survivorId,
  mergedId,
  fields,
}: MergeContactsInput): Promise<void> {
  // `returns void` arrives as null through PostgREST.
  await callRpc(
    'merge_contacts',
    {
      p_survivor_id: survivorId,
      p_merged_id: mergedId,
      p_fields: fields,
    },
    z.null(),
  )
}

function errorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) return ''
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' ? message : ''
}

/**
 * The one refusal the dialog can explain rather than merely report: both
 * contacts hold a conversation on the same channel, which
 * `conversations_contact_channel_unique` forbids the survivor from having.
 */
export function isConversationConflictError(error: unknown): boolean {
  return errorMessage(error).includes('CONTACT_MERGE_CONVERSATION_CONFLICT')
}

export function isNotAdminError(error: unknown): boolean {
  return errorMessage(error).includes('NOT_A_WORKSPACE_ADMIN')
}
