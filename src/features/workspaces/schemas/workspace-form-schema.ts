import { z } from 'zod'
import { WORKSPACE_CURATED_ICONS } from '@/entities/workspace'

/**
 * Icon validation runs against the curated set, not all ~1600 Lucide names.
 *
 * `iconNames` lives in the same module as `lucide-react/dynamic`'s import map,
 * so validating against it pulled every icon into the bundle — 158 kB gzip, on
 * every route, to check a string. The curated list is also the stricter rule:
 * only icons the picker offers and the app can draw are accepted.
 */
export const createWorkspaceFormSchema = z.object({
  description: z
    .string()
    .trim()
    .max(240, 'Keep the description under 240 characters.')
    .optional(),
  icon: z.enum(WORKSPACE_CURATED_ICONS, 'Pick a workspace icon.').optional(),
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters.'),
})

export type CreateWorkspaceFormValues = z.infer<
  typeof createWorkspaceFormSchema
>

export const createWorkspaceDefaultValues: CreateWorkspaceFormValues = {
  description: '',
  icon: 'briefcase',
  name: '',
}
