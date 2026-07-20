import { iconNames } from 'lucide-react/dynamic'
import type { IconName } from 'lucide-react/dynamic'

export const WORKSPACE_DEFAULT_ICON: IconName = 'briefcase'

const workspaceIconNames = new Set<string>(iconNames)

export const WORKSPACE_CURATED_ICONS: ReadonlyArray<IconName> = [
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
  'users-round',
  'lightbulb',
  'shield',
  'flame',
]

export function resolveWorkspaceIcon(
  icon: string | null | undefined,
): IconName {
  return icon && workspaceIconNames.has(icon)
    ? (icon as IconName)
    : WORKSPACE_DEFAULT_ICON
}
