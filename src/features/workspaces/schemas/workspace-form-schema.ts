import { m } from '@/paraglide/messages'
import { z } from 'zod'
// Imported from the leaf module rather than the entity barrel: the barrel also
// exports the icon components, which would drag 16 React components and an
// IconButton into every module that merely validates a form.
import { WORKSPACE_CURATED_ICONS } from '@/entities/workspace/lib/workspace-icons'

/**
 * Icon validation runs against the curated set, not all ~1600 Lucide names.
 *
 * `iconNames` lives in the same module as `lucide-react/dynamic`'s import map,
 * so validating against it pulled every icon into the bundle — 158 kB gzip, on
 * every route, to check a string. The curated list is also the stricter rule:
 * only icons the picker offers and the app can actually draw are accepted.
 *
 * Built per call rather than held as a module constant so validation copy
 * follows the active locale, matching the other forms. Callers memoize on
 * `getLocale()`.
 */
export function createWorkspaceFormSchema() {
  return z.object({
    description: z
      .string()
      .trim()
      .max(240, m.validation_description_max())
      .optional(),
    icon: z.enum(WORKSPACE_CURATED_ICONS, m.workspaces_icon_required()).optional(),
    name: z.string().trim().min(2, m.validation_name_min()),
  })
}

export type CreateWorkspaceFormValues = z.infer<
  ReturnType<typeof createWorkspaceFormSchema>
>

export const createWorkspaceDefaultValues: CreateWorkspaceFormValues = {
  description: '',
  icon: 'briefcase',
  name: '',
}
