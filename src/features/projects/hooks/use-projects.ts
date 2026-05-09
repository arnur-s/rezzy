import { getWorkspaceProjects, projectQueryKeys } from '../api/projects'
import { useQuery } from '@tanstack/react-query'

export function useWorkspaceProjects(workspaceIds: ReadonlyArray<string>) {
  return useQuery({
    enabled: workspaceIds.length > 0,
    queryFn: () => getWorkspaceProjects(workspaceIds),
    queryKey: projectQueryKeys.listByWorkspaces(workspaceIds),
  })
}
