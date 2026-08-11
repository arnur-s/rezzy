import {
  inviteWorkspaceMember,
  listMyInvitations,
  listWorkspaceInvitations,
  removeMember,
  respondToInvitation,
  revokeWorkspaceInvitation,
  updateMemberRole,
} from '@/features/workspaces/api/workspace-membership'
import { workspaceQueryKeys } from '@/features/workspaces/api/workspaces'
import { useAuth } from '@/providers/auth-provider'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

/**
 * The signed-in user's pending invitations, read app-wide by the workspace
 * switcher.
 *
 * Short `staleTime` rather than the roster's five minutes: an invitation is a
 * thing waiting on the user, and the realtime binding in the notifications
 * engine invalidates this key the moment one arrives — so this only has to
 * cover the gap before that subscription is established.
 */
export function useMyInvitations() {
  const { user } = useAuth()

  return useQuery({
    queryFn: listMyInvitations,
    queryKey: workspaceQueryKeys.myInvitations,
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  })
}

/** Pending invitations for one workspace. Owner/admin only — the RPC refuses
 *  anyone else, so this is gated by the caller rather than retried. */
export function useWorkspaceInvitations(
  workspaceId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryFn: () => listWorkspaceInvitations(workspaceId),
    queryKey: workspaceQueryKeys.invitations(workspaceId),
    enabled: enabled && !!workspaceId,
    retry: false,
  })
}

export function useInviteMember(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { email: string; role: string }) =>
      inviteWorkspaceMember({ workspaceId, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.invitations(workspaceId),
      })
    },
  })
}

export function useRevokeInvitation(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: revokeWorkspaceInvitation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.invitations(workspaceId),
      })
    },
  })
}

/**
 * Accept or reject. Not scoped to a workspace: the caller is not a member of it
 * yet, which is the whole point.
 */
export function useRespondToInvitation() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: respondToInvitation,
    onSuccess: async (workspaceId) => {
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.myInvitations,
      })
      // Accepting adds a workspace to the switcher and puts the user on a
      // roster; rejecting changes neither, so only accept invalidates them.
      if (workspaceId && user?.id) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: workspaceQueryKeys.list(user.id),
          }),
          queryClient.invalidateQueries({
            queryKey: workspaceQueryKeys.memberDirectory(workspaceId),
          }),
        ])
      }
    },
  })
}

export function useUpdateMemberRole(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; role: string }) =>
      updateMemberRole({ workspaceId, ...input }),
    onSuccess: async () => {
      await invalidateRoster(queryClient, workspaceId)
    },
  })
}

export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (input: { userId: string }) =>
      removeMember({ workspaceId, ...input }),
    onSuccess: async (_data, { userId }) => {
      await invalidateRoster(queryClient, workspaceId)
      // remove_workspace_member doubles as "leave": the RPC lets anyone remove
      // themselves. Doing so drops the workspace out of the caller's own list,
      // and `useWorkspaces` has no staleTime and no refetchOnWindowFocus — so
      // without this the workspace sits in the switcher until a hard reload,
      // pointing at content RLS has already withdrawn. Removing somebody else
      // changes nothing about the caller's list, hence the condition.
      if (user?.id && userId === user.id) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: workspaceQueryKeys.list(user.id),
          }),
          queryClient.invalidateQueries({
            queryKey: workspaceQueryKeys.detail(workspaceId),
          }),
        ])
      }
    },
  })
}

/**
 * `memberDirectory` is the one roster read left — the RPC that the settings
 * page and every assignee picker share. It carries a five-minute `staleTime`,
 * so a role change that skipped this would leave the inbox showing the old
 * role for that long.
 */
async function invalidateRoster(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
) {
  await queryClient.invalidateQueries({
    queryKey: workspaceQueryKeys.memberDirectory(workspaceId),
  })
}
