import {
  BoxesIcon,
  BriefcaseIcon,
  Building2Icon,
  CompassIcon,
  FlameIcon,
  FolderKanbanIcon,
  GaugeIcon,
  GlobeIcon,
  LayersIcon,
  LightbulbIcon,
  RocketIcon,
  ShieldIcon,
  SparklesIcon,
  StoreIcon,
  TargetIcon,
  UsersRoundIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { WorkspaceIconName } from '../lib/workspace-icons'
import { resolveWorkspaceIcon } from '../lib/workspace-icons'

/**
 * Static name-to-component map for the curated workspace icons.
 *
 * Replaces `DynamicIcon` from `lucide-react/dynamic`, which resolves a name
 * through a map of every Lucide icon. That map is a module-level object of
 * ~1600 `() => import(...)` thunks, so referencing it pulls all of them into
 * the graph: 1639 module requests in dev and a 649 kB chunk in production, to
 * draw one 16px glyph.
 *
 * Sixteen named imports tree-shake to exactly what is rendered, and the
 * `satisfies` keeps this exhaustive — adding a curated icon without a component
 * here is a type error, not a blank square at runtime.
 */
const WORKSPACE_ICON_COMPONENTS = {
  boxes: BoxesIcon,
  briefcase: BriefcaseIcon,
  'building-2': Building2Icon,
  compass: CompassIcon,
  flame: FlameIcon,
  'folder-kanban': FolderKanbanIcon,
  gauge: GaugeIcon,
  globe: GlobeIcon,
  layers: LayersIcon,
  lightbulb: LightbulbIcon,
  rocket: RocketIcon,
  shield: ShieldIcon,
  sparkles: SparklesIcon,
  store: StoreIcon,
  target: TargetIcon,
  'users-round': UsersRoundIcon,
} as const satisfies Record<WorkspaceIconName, LucideIcon>

export type WorkspaceIconProps = {
  className?: string
  /** Raw stored value; unknown names fall back to the default icon. */
  name: string | null | undefined
}

export function WorkspaceIcon({ className, name }: WorkspaceIconProps) {
  const Icon = WORKSPACE_ICON_COMPONENTS[resolveWorkspaceIcon(name)]
  return <Icon className={className} aria-hidden />
}
