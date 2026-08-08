import { describe, expect, it } from 'vitest'
import { WORKSPACE_CURATED_ICONS } from '@/entities/workspace/lib/workspace-icons'
import {
  createWorkspaceDefaultValues,
  createWorkspaceFormSchema,
} from './workspace-form-schema'

/**
 * Icon validation moved from "any of ~1600 Lucide names" to the curated set,
 * which is both cheaper and stricter. These pin the new contract: the form can
 * only produce an icon the app is able to draw.
 */
describe('createWorkspaceFormSchema', () => {
  const schema = createWorkspaceFormSchema()

  it.each(WORKSPACE_CURATED_ICONS)('accepts the curated icon %s', (icon) => {
    const result = schema.safeParse({ name: 'Sales', icon })
    expect(result.success).toBe(true)
  })

  it('rejects a Lucide icon outside the curated set', () => {
    // A real Lucide name, but not one this app ships a component for. The old
    // schema accepted it and rendered a blank square.
    const result = schema.safeParse({
      name: 'Sales',
      icon: 'banana',
    })
    expect(result.success).toBe(false)
  })

  it('allows the icon to be omitted', () => {
    const result = schema.safeParse({ name: 'Sales' })
    expect(result.success).toBe(true)
  })

  it('still enforces the name minimum', () => {
    expect(schema.safeParse({ name: 'a' }).success).toBe(false)
  })

  // The database gained the same 2-60 bound as a CHECK on workspaces.name, so a
  // longer name is refused by the table. Catching it here keeps that refusal a
  // field error rather than a raw constraint violation from the insert.
  it('enforces the 60-character maximum the table checks', () => {
    expect(schema.safeParse({ name: 'x'.repeat(60) }).success).toBe(true)
    expect(schema.safeParse({ name: 'x'.repeat(61) }).success).toBe(false)
  })

  it('ships defaults that satisfy its own schema', () => {
    const result = schema.safeParse({
      ...createWorkspaceDefaultValues,
      name: 'Sales',
    })
    expect(result.success).toBe(true)
  })

  it('reports validation failures in the active locale, not in English', () => {
    const result = schema.safeParse({ name: 'a' })
    expect(result.success).toBe(false)
    // The whole reason the schema became a factory: a module-level constant
    // froze whichever locale was active on first import, which shipped English
    // errors into a Russian interface.
    expect(result.error?.issues[0]?.message).not.toMatch(/[A-Za-z]{4,}/)
  })
})
