import { m } from '@/paraglide/messages'
import { isWorkspaceMemberRole } from '../model/member'
import type { WorkspaceMemberRole } from '../model/member'

const ROLE_LABELS: Record<WorkspaceMemberRole, () => string> = {
  owner: () => m.workspace_settings_members_role_owner(),
  admin: () => m.workspace_settings_members_role_admin(),
  member: () => m.workspace_settings_members_role_member(),
  viewer: () => m.workspace_settings_members_role_viewer(),
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
