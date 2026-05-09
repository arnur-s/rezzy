import { supabase } from '@/utils/supabase'

export const projectQueryKeys = {
  all: ['projects'] as const,
  listByWorkspaces: (workspaceIds: ReadonlyArray<string>) =>
    ['projects', 'list-by-workspaces', ...workspaceIds] as const,
}

export async function getWorkspaceProjects(
  workspaceIds: ReadonlyArray<string>,
) {
  if (workspaceIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .in('workspace_id', [...workspaceIds])
    .order('name', { ascending: true })

  if (error) {
    throw error
  }

  return data
}
