import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROUTE = resolve(process.cwd(), 'src/routes/_authenticated.tsx')

/**
 * A wiring guard, not a behaviour test.
 *
 * Every timestamp in the app is formatted in whatever zone `useSyncTimeZone`
 * installs, and this route is the only place that installs it. Deleting the
 * call broke nothing: the hook's own suite proves the hook works, and proved
 * nothing about it being invoked, so the feature could have been disconnected
 * with the whole suite green.
 *
 * Asserted against the source rather than by rendering, because the router
 * plugin code-splits this file: importing the component means exporting it,
 * which the plugin warns pulls the route out of its own chunk. A shipping
 * regression is too high a price for a neater test, and the thing actually at
 * risk here is someone deleting a line, which the source can answer.
 *
 * The limit is worth stating plainly: this proves the call is written, not that
 * it runs. What happens once it runs is covered by the hook's own suite and by
 * the propagation test.
 */
describe('authenticated route preference wiring', () => {
  const source = readFileSync(ROUTE, 'utf8')

  it('installs the account time zone', () => {
    expect(source).toContain('useSyncTimeZone()')
    expect(source).toMatch(/import\s*{[^}]*useSyncTimeZone[^}]*}\s*from\s*'@\/features\/account'/)
  })

  it('installs the account language', () => {
    expect(source).toContain('useSyncLanguagePreference()')
  })

  it('installs them above the shell, so nothing renders a date first', () => {
    const zoneAt = source.indexOf('useSyncTimeZone()')
    const shellAt = source.indexOf('<AppShell')

    expect(zoneAt).toBeGreaterThan(-1)
    expect(shellAt).toBeGreaterThan(-1)
    expect(zoneAt).toBeLessThan(shellAt)
  })
})
