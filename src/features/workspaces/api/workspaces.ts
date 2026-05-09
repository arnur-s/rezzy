import type { TablesInsert } from '@/api/types'
import { supabase } from '@/utils/supabase'
import type { CreateWorkspaceFormValues } from '../schemas/workspace-form-schema'

export const workspaceQueryKeys = {
  all: ['workspaces'] as const,
  detail: (workspaceId: string) =>
    ['workspaces', 'detail', workspaceId] as const,
  list: (userId: string) => ['workspaces', 'list', userId] as const,
}

export async function getUserWorkspaces(userId: string) {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('created_by', userId)
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

  return data
}

function normalizeDescription(description: string | undefined) {
  const value = description?.trim()

  return value ? value : null
}
