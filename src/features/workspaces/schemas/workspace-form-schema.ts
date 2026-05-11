import {  iconNames } from 'lucide-react/dynamic'
import { z } from 'zod'
import type {IconName} from 'lucide-react/dynamic';

const iconNameSet = new Set<string>(iconNames)

export const createWorkspaceFormSchema = z.object({
  description: z
    .string()
    .trim()
    .max(240, 'Keep the description under 240 characters.')
    .optional(),
  icon: z
    .custom<IconName>(
      (value) => typeof value === 'string' && iconNameSet.has(value),
      'Pick a workspace icon.',
    )
    .optional(),
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
