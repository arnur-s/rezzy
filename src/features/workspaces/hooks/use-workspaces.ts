import {
  createWorkspace,
  getUserWorkspaces,
  getWorkspace,
  getWorkspaceMembers,
  listWorkspaceMembers,
  updateWorkspace,
  workspaceQueryKeys,
} from '@/features/workspaces/api/workspaces'
import type { CreateWorkspaceFormValues } from '@/features/workspaces/schemas/workspace-form-schema'
import { useAuth } from '@/providers/auth-provider'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

export function useWorkspaces(userId?: string) {
  return useQuery({
    queryFn: getUserWorkspaces,
    queryKey: workspaceQueryKeys.list(userId!),
    enabled: !!userId,
    refetchOnWindowFocus: false,
  })
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryFn: () => getWorkspace(workspaceId),
    queryKey: workspaceQueryKeys.detail(workspaceId),
    enabled: !!workspaceId,
    refetchOnWindowFocus: false,
  })
}

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryFn: () => getWorkspaceMembers(workspaceId),
    queryKey: workspaceQueryKeys.members(workspaceId),
    enabled: !!workspaceId,
    refetchOnWindowFocus: false,
  })
}

/**
 * The workspace roster, cached once per workspace.
 *
 * Every surface that shows a teammate reads from this one query rather than
 * embedding profile rows in its own payload. A colleague who changes their
 * name, photo or phone then changes everywhere at once, and a conversation
 * list of 200 rows still costs one roster fetch instead of a join per row.
 *
 * Long `staleTime` on purpose: a roster changes when somebody is invited or
 * leaves, which is a different order of magnitude from the inbox's own
 * traffic. The assignee mutation invalidates nothing here, because assigning a
 * conversation does not change who is in the workspace.
 */
export function useWorkspaceMemberDirectory(workspaceId: string) {
  return useQuery({
    queryFn: () => listWorkspaceMembers(workspaceId),
    queryKey: workspaceQueryKeys.memberDirectory(workspaceId),
    enabled: !!workspaceId,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * The same roster keyed by user id, for resolving a stored `assigned_to` /
 * `owner_id` into a person.
 *
 * `isLoaded` is not a convenience flag, it is required to read the result
 * correctly. A miss means one of two very different things — "this id belongs
 * to somebody who has left the workspace" or "the roster has not arrived yet" —
 * and a caller that treats the second as the first flashes a stranger's
 * placeholder onto every assigned row for the length of one fetch.
 */
export function useWorkspaceMemberLookup(workspaceId: string) {
  const directory = useWorkspaceMemberDirectory(workspaceId)
  const members = directory.data

  return useMemo(
    () => ({
      lookup: new Map((members ?? []).map((member) => [member.userId, member])),
      isLoaded: members !== undefined,
    }),
    [members],
  )
}

/**
 * Whether the signed-in user may take owner/admin-only actions in a workspace.
 *
 * Derived from the roster query the callers already hold, so this costs no
 * extra request. It gates affordances only — every action it hides is enforced
 * again in the database, which is what actually decides.
 *
 * `isLoaded` matters for the same reason it does in `useWorkspaceMemberLookup`:
 * before the roster arrives, "not an admin" and "not known yet" are the same
 * `false`, and a caller that renders the difference would flash an admin
 * control away from someone who has it.
 */
export function useIsWorkspaceAdmin(workspaceId: string) {
  const { user } = useAuth()
  const directory = useWorkspaceMemberDirectory(workspaceId)
  const members = directory.data

  return useMemo(() => {
    const role = members?.find((member) => member.userId === user?.id)?.role
    return {
      isAdmin: role === 'owner' || role === 'admin',
      isLoaded: members !== undefined,
    }
  }, [members, user?.id])
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
