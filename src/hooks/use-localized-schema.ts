import { getLocale } from '@/paraglide/runtime'
import { useMemo } from 'react'

/**
 * Memoizes a Zod schema whose validation messages come from Paraglide.
 *
 * Zod reads its messages when the schema is *constructed*, so a schema held as
 * a module constant freezes whichever locale happened to be active when its
 * module first evaluated — which is how the channel, workspace, and sign-up
 * forms ended up showing English errors inside a Russian interface. Building
 * per render fixes the language but hands React Hook Form a new resolver on
 * every keystroke; this keeps exactly one instance per locale.
 *
 * `create` must be a stable module-level factory. It is intentionally not a
 * dependency: an inline arrow at a call site would rebuild the schema every
 * render and defeat the memo.
 *
 * @example
 * const schema = useLocalizedSchema(createWorkspaceFormSchema)
 * useForm({ resolver: standardSchemaResolver(schema) })
 */
export function useLocalizedSchema<T>(create: () => T): T {
  const locale = getLocale()
  return useMemo(() => create(), [locale, create])
}
