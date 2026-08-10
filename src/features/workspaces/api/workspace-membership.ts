import { m } from '@/paraglide/messages'
import { supabase } from '@/utils/supabase'

/**
 * One pending invitation as its recipient sees it.
 *
 * Comes from `public.list_my_workspace_invitations`, not from a table read: the
 * invitee can select their own pending row, but not the workspace name, the
 * icon, or the inviter's name, all of which belong to relations they are not a
 * member of yet.
 */
export type WorkspaceInvitation = {
  id: string
  workspaceId: string
  workspaceName: string
  workspaceIcon: string | null
  role: string
  invitedByName: string | null
  createdAt: string
}

/** One pending invitation as an owner or admin of the workspace sees it. */
export type WorkspaceInvitationForAdmin = {
  id: string
  invitedEmail: string
  invitedName: string
  role: string
  invitedByName: string | null
  createdAt: string
}

/** The RPC tokens {@link membershipErrorMessage} knows how to localize. */
export type MembershipErrorToken =
  | 'USER_NOT_FOUND'
  | 'ALREADY_A_MEMBER'
  | 'CANNOT_INVITE_SELF'
  | 'INVALID_ROLE'
  | 'NOT_A_WORKSPACE_ADMIN'
  | 'OWNER_ROLE_REQUIRES_OWNER'
  | 'LAST_OWNER'
  | 'MEMBER_NOT_FOUND'
  | 'INVITATION_NOT_FOUND'

/**
 * The tokens the membership RPCs raise as their exception message.
 *
 * They are identifiers, not copy: every one is mapped to a localized string
 * below. Postgres error text must never reach a user.
 */
const MEMBERSHIP_ERROR_MESSAGES: Record<string, (() => string) | undefined> = {
  USER_NOT_FOUND: () =>
    m.workspace_settings_members_invite_error_user_not_found(),
  ALREADY_A_MEMBER: () =>
    m.workspace_settings_members_invite_error_already_member(),
  CANNOT_INVITE_SELF: () => m.workspace_settings_members_invite_error_self(),
  // The role controls only ever offer valid roles, so this is unreachable
  // except by a hand-crafted request. Mapped explicitly to the generic
  // message anyway, so the fallback below stays a decision made here rather
  // than a hole this token happens to fall through.
  INVALID_ROLE: () => m.workspace_settings_members_error_generic(),
  NOT_A_WORKSPACE_ADMIN: () => m.workspace_settings_members_error_not_admin(),
  OWNER_ROLE_REQUIRES_OWNER: () =>
    m.workspace_settings_members_error_owner_only(),
  LAST_OWNER: () => m.workspace_settings_members_error_last_owner(),
  MEMBER_NOT_FOUND: () => m.workspace_settings_members_error_member_gone(),
  INVITATION_NOT_FOUND: () =>
    m.workspace_settings_members_error_invitation_gone(),
}

/**
 * Turns an RPC error into a localized, user-safe string.
 *
 * Every membership RPC raises its failure as a machine-readable token in the
 * exception `message` (never user-facing text). Anything that is not one of
 * the known tokens — including `NOT_AUTHENTICATED`, which every RPC can also
 * raise but has no dedicated copy, and raw Postgres error text — falls back to
 * the generic message rather than leaking internals to the user.
 */
export function membershipErrorMessage(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : ''

  return (
    MEMBERSHIP_ERROR_MESSAGES[message]?.() ??
    m.workspace_settings_members_error_generic()
  )
}

export async function listMyInvitations(): Promise<Array<WorkspaceInvitation>> {
  const { data, error } = await supabase.rpc('list_my_workspace_invitations')

  if (error) throw error

  // Postgres records no nullability for a function's RETURNS TABLE, so the
  // generated type says `string` for columns that are nullable at the source.
  // Normalised here rather than letting an absent icon travel as '' into the UI.
  return data.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    workspaceIcon: nullIfBlank(row.workspace_icon),
    role: row.role,
    invitedByName: nullIfBlank(row.invited_by_name),
    createdAt: row.created_at,
  }))
}

export async function listWorkspaceInvitations(
  workspaceId: string,
): Promise<Array<WorkspaceInvitationForAdmin>> {
  const { data, error } = await supabase.rpc('list_workspace_invitations', {
    p_workspace_id: workspaceId,
  })

  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    invitedEmail: row.invited_email,
    invitedName: row.invited_name,
    role: row.role,
    invitedByName: nullIfBlank(row.invited_by_name),
    createdAt: row.created_at,
  }))
}

export async function inviteWorkspaceMember({
  workspaceId,
  email,
  role,
}: {
  workspaceId: string
  email: string
  role: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('invite_workspace_member', {
    p_workspace_id: workspaceId,
    p_email: email,
    p_role: role,
  })

  if (error) throw error

  return data
}

export async function revokeWorkspaceInvitation(
  invitationId: string,
): Promise<void> {
  const { error } = await supabase.rpc('revoke_workspace_invitation', {
    p_invitation_id: invitationId,
  })

  if (error) throw error
}

export async function respondToInvitation({
  invitationId,
  accept,
}: {
  invitationId: string
  accept: boolean
}): Promise<string | null> {
  const { data, error } = await supabase.rpc(
    'respond_to_workspace_invitation',
    { p_invitation_id: invitationId, p_accept: accept },
  )

  if (error) throw error

  return data
}

export async function updateMemberRole({
  workspaceId,
  userId,
  role,
}: {
  workspaceId: string
  userId: string
  role: string
}): Promise<void> {
  const { error } = await supabase.rpc('update_workspace_member_role', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_role: role,
  })

  if (error) throw error
}

export async function removeMember({
  workspaceId,
  userId,
}: {
  workspaceId: string
  userId: string
}): Promise<void> {
  const { error } = await supabase.rpc('remove_workspace_member', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
  })

  if (error) throw error
}

function nullIfBlank(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
