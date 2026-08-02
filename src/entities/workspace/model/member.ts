/**
 * A person inside one workspace: their profile fields and the role that
 * workspace gives them.
 *
 * This is deliberately not `Tables<'profiles'>`. `public.profiles` and
 * `public.workspace_members` are both own-row-only under RLS, so the browser
 * can never select a colleague's row — every teammate the product shows
 * arrives through `public.list_workspace_members`, which is the only surface
 * that can see past those policies. Typing the roster to the RPC's return
 * shape keeps that constraint visible: if a field is not on this type, it is
 * not readable about a teammate, and adding it means changing a migration.
 */
export type WorkspaceMember = {
  userId: string
  role: string
  fullName: string
  avatarUrl: string | null
  /** Free text the member sets on their own profile, e.g. "Account manager". */
  jobTitle: string | null
  phone: string | null
  joinedAt: string
}

export const WORKSPACE_MEMBER_ROLES = [
  'owner',
  'admin',
  'member',
  'viewer',
] as const

export type WorkspaceMemberRole = (typeof WORKSPACE_MEMBER_ROLES)[number]

export function isWorkspaceMemberRole(
  value: string,
): value is WorkspaceMemberRole {
  return (WORKSPACE_MEMBER_ROLES as ReadonlyArray<string>).includes(value)
}
