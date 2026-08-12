/**
 * The icons a workspace may actually be given.
 *
 * Deliberately a fixed list rather than all ~1600 Lucide names. Validating
 * against the full set costs nothing at runtime, but importing it does:
 * `lucide-react/dynamic` exports `iconNames` from the same module as its
 * dynamic-import map, so touching the name list drags every icon into the
 * graph. That was the difference between a small entry chunk and a 158 kB
 * (gzip) one, paid on the sign-in page, which draws three icons.
 *
 * A closed list is also the honest model: the picker only ever offered these,
 * and `ui/workspace-icon.tsx` can only draw these.
 *
 * `users-round` is deliberately absent. The sidebar draws the current
 * workspace's icon as a bare 16px glyph at the same size and tone as the
 * navigation rows beneath it, one of which is Contacts — also `UsersRound`.
 * Collapsed, the rail is glyphs alone, so offering it here means offering a
 * workspace mark indistinguishable from a destination two rows below it.
 */
export const WORKSPACE_CURATED_ICONS = [
  'briefcase',
  'building-2',
  'rocket',
  'folder-kanban',
  'boxes',
  'sparkles',
  'layers',
  'compass',
  'globe',
  'target',
  'gauge',
  'store',
  'lightbulb',
  'shield',
  'flame',
] as const

export type WorkspaceIconName = (typeof WORKSPACE_CURATED_ICONS)[number]

export const WORKSPACE_DEFAULT_ICON: WorkspaceIconName = 'briefcase'

const workspaceIconNames = new Set<string>(WORKSPACE_CURATED_ICONS)

/**
 * Narrows a stored icon name to one this app can draw.
 *
 * Rows written while an icon was still on the list keep resolving; anything
 * else falls back, so a workspace never renders a blank square.
 */
export function resolveWorkspaceIcon(
  icon: string | null | undefined,
): WorkspaceIconName {
  return icon && workspaceIconNames.has(icon)
    ? (icon as WorkspaceIconName)
    : WORKSPACE_DEFAULT_ICON
}
