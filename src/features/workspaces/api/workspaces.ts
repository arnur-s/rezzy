import type { Tables, TablesUpdate } from '@/api/types'
import type { WorkspaceMember } from '@/entities/workspace'
import { supabase } from '@/utils/supabase'
import type { CreateWorkspaceFormValues } from '../schemas/workspace-form-schema'

export const workspaceQueryKeys = {
  all: ['workspaces'] as const,
  detail: (workspaceId: string) =>
    ['workspaces', 'detail', workspaceId] as const,
  list: (userId: string) => ['workspaces', 'list', userId] as const,
  members: (workspaceId: string) =>
    ['workspaces', 'members', workspaceId] as const,
  memberDirectory: (workspaceId: string) =>
    ['workspaces', 'member-directory', workspaceId] as const,
  myInvitations: ['workspaces', 'my-invitations'] as const,
  invitations: (workspaceId: string) =>
    ['workspaces', 'invitations', workspaceId] as const,
}

export async function getUserWorkspaces() {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .order('is_main', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return data
}

export async function getWorkspace(workspaceId: string) {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single()

  if (error) {
    throw error
  }

  return data
}

type WorkspaceMemberProfile = {
  avatar_url: string | null
  email: string | null
  full_name: string | null
  id: string
}

export type WorkspaceMemberWithProfile = Tables<'workspace_members'> & {
  profile: WorkspaceMemberProfile | null
}

/**
 * Direct table read, and therefore only ever the caller's own membership:
 * `public.workspace_members` is `user_id = auth.uid()` and `public.profiles` is
 * `id = auth.uid()`, so the embedded profile resolves for nobody else.
 *
 * Kept as-is because its one consumer (the members stub in workspace settings)
 * has not been rebuilt. Anything that needs the actual roster must use
 * {@link listWorkspaceMembers}, which goes through the RPC that can see past
 * those policies.
 */
export async function getWorkspaceMembers(
  workspaceId: string,
): Promise<Array<WorkspaceMemberWithProfile>> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*, profile:profiles(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return data as unknown as Array<WorkspaceMemberWithProfile>
}

/**
 * The workspace roster: every member, with the profile fields the product
 * renders for a teammate.
 *
 * `public.list_workspace_members` is SECURITY DEFINER because both source
 * tables are own-row-only under RLS; it re-establishes the workspace boundary
 * itself via `public.is_workspace_member`, so a non-member gets an error rather
 * than a roster.
 *
 * The generated `Returns` type says `string` for every column, because Postgres
 * records no nullability for a function's RETURNS TABLE. Three of them are
 * nullable in `public.profiles`, so this normalises them here rather than
 * letting an empty avatar or a missing job title travel as `''` into the UI.
 */
export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<Array<WorkspaceMember>> {
  const { data, error } = await supabase.rpc('list_workspace_members', {
    p_workspace_id: workspaceId,
  })

  if (error) {
    throw error
  }

  return data.map((row) => ({
    userId: row.user_id,
    role: row.role,
    fullName: row.full_name,
    avatarUrl: nullIfBlank(row.avatar_url),
    jobTitle: nullIfBlank(row.job_title),
    phone: nullIfBlank(row.phone),
    joinedAt: row.joined_at,
  }))
}

function nullIfBlank(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function createWorkspace({
  description,
  icon,
  isMain,
  name,
}: CreateWorkspaceFormValues & { isMain: boolean; userId: string }) {
  // Not an insert: public.workspaces has no INSERT grant for authenticated.
  // The RPC exists so the browser never issues INSERT ... RETURNING here — see
  // the header of 20260809140000. `userId` stays in the parameter list because
  // useCreateWorkspace passes it, but identity comes from auth.uid() inside the
  // function and cannot be supplied by the caller.
  const { data, error } = await supabase.rpc('create_workspace', {
    p_name: name.trim(),
    // RPC args map a `default null` Postgres parameter to an optional key
    // typed as `string | undefined`, not `string | null` — unlike a table
    // column, which accepts null directly. Omitting the key reaches the same
    // default as passing null explicitly, so this coerces rather than
    // changing normalizeDescription's contract for updateWorkspace below.
    p_description: normalizeDescription(description) ?? undefined,
    p_icon: icon,
    p_is_main: isMain,
  })

  if (error) {
    throw error
  }

  return data
}

export async function updateWorkspace({
  description,
  icon,
  id,
  name,
}: {
  description?: string
  icon?: string | null
  id: string
  name: string
}) {
  const updatePayload: TablesUpdate<'workspaces'> = {
    description: normalizeDescription(description),
    icon: icon ?? null,
    name: name.trim(),
  }

  const { data, error } = await supabase
    .from('workspaces')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

function normalizeDescription(description: string | undefined) {
  const value = description?.trim()

  return value ? value : null
}
