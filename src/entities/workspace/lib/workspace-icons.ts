import { m } from '@/paraglide/messages'

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

/**
 * The localized name of an icon, for the picker's accessible labels.
 *
 * The tiles are icon-only `IconButton`s, so this string *is* their accessible
 * name — it used to be the raw slug, which put `briefcase` and `folder-kanban`
 * into a Russian interface as the only thing a screen-reader user heard. Called
 * at render time rather than hoisted, for the reason given on
 * `workspaceMemberRoleLabel`: Paraglide resolves the locale on call.
 */
export function workspaceIconLabel(name: WorkspaceIconName): string {
  return ICON_LABELS[name]()
}

const ICON_LABELS: Record<WorkspaceIconName, () => string> = {
  briefcase: () => m.workspaces_icon_briefcase(),
  'building-2': () => m.workspaces_icon_building_2(),
  rocket: () => m.workspaces_icon_rocket(),
  'folder-kanban': () => m.workspaces_icon_folder_kanban(),
  boxes: () => m.workspaces_icon_boxes(),
  sparkles: () => m.workspaces_icon_sparkles(),
  layers: () => m.workspaces_icon_layers(),
  compass: () => m.workspaces_icon_compass(),
  globe: () => m.workspaces_icon_globe(),
  target: () => m.workspaces_icon_target(),
  gauge: () => m.workspaces_icon_gauge(),
  store: () => m.workspaces_icon_store(),
  lightbulb: () => m.workspaces_icon_lightbulb(),
  shield: () => m.workspaces_icon_shield(),
  flame: () => m.workspaces_icon_flame(),
}

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
