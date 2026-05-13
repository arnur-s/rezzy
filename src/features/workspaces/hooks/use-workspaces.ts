import {
  createWorkspace,
  getUserWorkspaces,
  getWorkspace,
  getWorkspaceMembers,
  updateWorkspace,
  workspaceQueryKeys,
} from '@/features/workspaces/api/workspaces'
import type { CreateWorkspaceFormValues } from '@/features/workspaces/schemas/workspace-form-schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useWorkspaces(userId?: string) {
  return useQuery({
    queryFn: () => getUserWorkspaces(userId!),
    queryKey: workspaceQueryKeys.list(userId!),
    enabled: !!userId,
  })
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryFn: () => getWorkspace(workspaceId),
    queryKey: workspaceQueryKeys.detail(workspaceId),
    enabled: !!workspaceId,
  })
}

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryFn: () => getWorkspaceMembers(workspaceId),
    queryKey: workspaceQueryKeys.members(workspaceId),
    enabled: !!workspaceId,
  })
}

export function useCreateWorkspace({
  hasMainWorkspace,
  userId,
}: {
  hasMainWorkspace: boolean
  userId: string
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: CreateWorkspaceFormValues) =>
      createWorkspace({
        ...values,
        isMain: !hasMainWorkspace,
        userId,
      }),
    onSuccess: async (workspace) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceQueryKeys.list(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceQueryKeys.detail(workspace.id),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceQueryKeys.members(workspace.id),
        }),
      ])
    },
  })
}

export function useUpdateWorkspace(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateWorkspace,
    onSuccess: async (workspace) => {
      queryClient.setQueryData(
        workspaceQueryKeys.detail(workspace.id),
        workspace,
      )
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceQueryKeys.detail(workspace.id),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceQueryKeys.list(userId),
        }),
      ])
    },
  })
}
