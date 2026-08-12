import { m } from '@/paraglide/messages'
import { isWorkspaceMemberRole } from '../model/member'
import type { WorkspaceMemberRole } from '../model/member'

const ROLE_LABELS: Record<WorkspaceMemberRole, () => string> = {
  owner: () => m.workspace_settings_members_role_owner(),
  admin: () => m.workspace_settings_members_role_admin(),
  member: () => m.workspace_settings_members_role_member(),
}

/**
 * `workspace_members.role` is a bare `text` column, so an unrecognised value is
 * reachable from the database rather than only from a bug. It falls through to
 * itself: showing the raw role beats showing nothing where the role is the
 * whole point of the line.
 *
 * Called at render time, never memoised into a module constant — Paraglide
 * resolves the active locale on call, so a hoisted string would freeze whichever
 * locale happened to be active on first import.
 */
export function workspaceMemberRoleLabel(role: string): string {
  return isWorkspaceMemberRole(role) ? ROLE_LABELS[role]() : role
}

const ROLE_DESCRIPTIONS: Record<WorkspaceMemberRole, () => string> = {
  owner: () => m.workspace_settings_members_role_owner_description(),
  admin: () => m.workspace_settings_members_role_admin_description(),
  member: () => m.workspace_settings_members_role_member_description(),
}

/**
 * What a role can actually do, in one line.
 *
 * A bare role noun is a permissions decision with no information attached: an
 * admin picking between "Администратор" and "Участник" for a new hire has
 * nothing to read, and there is no permissions page anywhere in the product to
 * send them to. Unknown roles get no line rather than an invented one — the
 * label already falls through to the raw value, and guessing at a role the app
 * does not define would be worse than silence.
 */
export function workspaceMemberRoleDescription(role: string): string | null {
  return isWorkspaceMemberRole(role) ? ROLE_DESCRIPTIONS[role]() : null
}

const ROLE_GROUP_LABELS: Record<WorkspaceMemberRole, () => string> = {
  owner: () => m.workspace_settings_members_group_owner(),
  admin: () => m.workspace_settings_members_group_admin(),
  member: () => m.workspace_settings_members_group_member(),
}

/**
 * The heading over a group of members holding one role.
 *
 * A fixed plural noun rather than a count, so it needs no plural variants: the
 * group's own length is visible directly beneath it, and "Владельцы 1" would be
 * the kind of counted string Russian needs three forms for to say nothing.
 */
export function workspaceMemberRoleGroupLabel(role: string): string {
  return isWorkspaceMemberRole(role) ? ROLE_GROUP_LABELS[role]() : role
}
