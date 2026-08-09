import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ACCOUNT_SHELL = resolve(process.cwd(), 'src/routes/_authenticated/settings.tsx')
const WORKSPACE_SHELL = resolve(
  process.cwd(),
  'src/routes/_authenticated/workspaces/$id/settings.tsx',
)

/**
 * A class-contract guard, not a behaviour test.
 *
 * jsdom has no layout, so it cannot see that a tab row overflows or that a
 * field is flush against the screen edge. What it can see is whether the
 * classes that prevent both are still written down — and that is the thing
 * that has actually gone wrong here, twice.
 *
 * The tab overflow was fixed in `eb6c796` and lost again in `1707dcb`, where
 * `-mx-4 overflow-x-auto px-4` was mangled into the single invalid token
 * `-mx-4px-4`. Tailwind emits nothing for it, so the overflow container and
 * both insets disappeared together, in a change that touched neither the
 * layout nor the tabs on purpose. Every check stayed green: it typechecks
 * (it is a string), it lints, and the browser check that would have caught
 * it — `check:overflow` — was removed from `package.json` in the same period.
 *
 * Why the classes matter, measured at 390px in Russian before the fix:
 *
 *  - no `overflow-x-auto`: the row's 446px of tabs overflow into the pane's
 *    own `overflow-y-auto`, which per CSS scrolls sideways too, so reaching
 *    the last tab panned the whole settings page 71px — heading, form fields
 *    and all.
 *  - no `px-4`: the column loses the settings inset DESIGN.md specifies, and
 *    every field renders flush against both screen edges.
 *  - no `-mx-4`: the row stops bleeding to the pane edges, so a scrolled tab
 *    sits hard against the viewport edge.
 *
 * The limit is worth stating plainly: this proves the classes are written, not
 * that they render. The rendered result belongs in a browser at phone width,
 * which is where these numbers came from.
 */
describe('settings shell mobile contract', () => {
  const shells = [
    ['account', readFileSync(ACCOUNT_SHELL, 'utf8')],
    ['workspace', readFileSync(WORKSPACE_SHELL, 'utf8')],
  ] as const

  /**
   * The row's own class string, found by the one utility only it carries.
   * Read as a set of tokens rather than matched as a fixed sequence: the
   * order Tailwind classes are written in has no meaning, and pinning it
   * fails on unrelated edits while still missing a token quietly dropped
   * from the middle.
   */
  function tabRowClasses(source: string) {
    const row = source.match(/className="([^"]*\boverflow-x-auto\b[^"]*)"/)
    return new Set(row?.[1].split(/\s+/) ?? [])
  }

  for (const [name, source] of shells) {
    describe(`${name} settings`, () => {
      const row = tabRowClasses(source)

      it('gives the tab row its own horizontal scroll container', () => {
        expect(row.has('overflow-x-auto')).toBe(true)
      })

      it('bleeds that row to the pane edges while keeping the page inset', () => {
        // Both halves or neither: a bleed whose padding went missing is what
        // puts the first tab flush against the screen edge.
        for (const cls of ['-mx-4', 'px-4', 'sm:-mx-8', 'sm:px-8']) {
          expect(row.has(cls)).toBe(true)
        }
      })

      it('keeps a revealed tab off the edge when there is room', () => {
        // scroll-padding, so `scrollIntoView` and arrow-key movement stop
        // short of the inset instead of aligning to the padding box.
        expect(row.has('scroll-px-4')).toBe(true)
        expect(row.has('sm:scroll-px-8')).toBe(true)
      })

      it('keeps a 44px touch target on the tabs for coarse pointers', () => {
        expect(row.has('pointer-coarse:[&_button]:min-h-11')).toBe(true)
      })

      it('insets the scrolling column, so no field sits on the screen edge', () => {
        expect(source).toMatch(/mx-auto w-full max-w-3xl px-4[^"]*sm:px-8/)
      })
    })
  }

  it('aligns the account header with the column beneath it', () => {
    // The header used to run `px-4 sm:px-0` against a column with no padding
    // at all, which put the title 16px inside fields that started at 0.
    const [, source] = shells[0]
    const headerInsets = source.match(/mx-auto w-full max-w-3xl px-4[^"]*/g) ?? []

    expect(headerInsets.length).toBeGreaterThanOrEqual(2)
    expect(new Set(headerInsets.map((cls) => cls.includes('sm:px-8'))).size).toBe(1)
  })

  it('leaves the account column room to scroll past its last row', () => {
    const [, source] = shells[0]
    expect(source).toMatch(/max-w-3xl px-4 pb-8 sm:px-8/)
  })
})
