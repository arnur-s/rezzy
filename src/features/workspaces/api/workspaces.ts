import type { Tables, TablesInsert, TablesUpdate } from '@/api/types'
import { supabase } from '@/utils/supabase'
import type { CreateWorkspaceFormValues } from '../schemas/workspace-form-schema'

export const workspaceQueryKeys = {
  all: ['workspaces'] as const,
  detail: (workspaceId: string) =>
    ['workspaces', 'detail', workspaceId] as const,
  list: (userId: string) => ['workspaces', 'list', userId] as const,
  members: (workspaceId: string) =>
    ['workspaces', 'members', workspaceId] as const,
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

export async function createWorkspace({
  description,
  icon,
  isMain,
  name,
  userId,
}: CreateWorkspaceFormValues & { isMain: boolean; userId: string }) {
  const insertPayload: TablesInsert<'workspaces'> = {
    created_by: userId,
    description: normalizeDescription(description),
    icon: icon ?? null,
    is_main: isMain,
    name: name.trim(),
  }

  const { data, error } = await supabase
    .from('workspaces')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    throw error
  }

  // The on_workspace_created database trigger creates the owner membership.

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
