import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SHELL = resolve(process.cwd(), 'src/components/settings-shell.tsx')
const ACCOUNT_ROUTE = resolve(
  process.cwd(),
  'src/routes/_authenticated/settings.tsx',
)
const WORKSPACE_ROUTE = resolve(
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
 * Why the classes matter, measured at 390px in Russian:
 *
 *  - no `overflow-x-auto`: the row's 446px of tabs overflow into the pane's
 *    own `overflow-y-auto`, which per CSS scrolls sideways too, so reaching
 *    the last tab panned the whole settings page 71px — heading, form fields
 *    and all.
 *  - no `overflow-y-hidden`: `overflow-x: auto` alone computes the untouched
 *    axis to `auto` as well, so the row becomes a scroll container in both
 *    directions and grows a vertical scrollbar of its own.
 *  - no `px-4`: the column loses the settings inset DESIGN.md specifies, and
 *    every field renders flush against both screen edges.
 *  - no `-mx-4`: the row stops bleeding to the pane edges, so a scrolled tab
 *    sits hard against the viewport edge.
 *
 * There is one shell now rather than a copy per settings area, so this reads
 * the component — plus enough of each route to prove it still goes through it,
 * because a route that rebuilds the pane by hand is how the two copies drifted
 * apart in the first place.
 *
 * The limit is worth stating plainly: this proves the classes are written, not
 * that they render. The rendered result belongs in a browser at phone width,
 * which is where these numbers came from.
 */
describe('settings shell mobile contract', () => {
  const shell = readFileSync(SHELL, 'utf8')

  /**
   * The row's own class string, found by the one utility only it carries.
   * Read as a set of tokens rather than matched as a fixed sequence: the
   * order Tailwind classes are written in has no meaning, and pinning it
   * fails on unrelated edits while still missing a token quietly dropped
   * from the middle.
   */
  const row = new Set(
    shell
      .match(/className="([^"]*\boverflow-x-auto\b[^"]*)"/)?.[1]
      .split(/\s+/) ?? [],
  )

  it('gives the tab row its own horizontal scroll container', () => {
    expect(row.has('overflow-x-auto')).toBe(true)
  })

  it('keeps that scroll horizontal only', () => {
    // CSS turns the neighbour of a non-visible axis into `auto`, so the row
    // scrolls vertically too unless the cross axis is pinned — and `pb-1` is
    // the room that leaves for a focused tab's 2px-offset ring, which a hidden
    // axis would otherwise clip.
    expect(row.has('overflow-y-hidden')).toBe(true)
    expect(row.has('pb-1')).toBe(true)
  })

  it('scrolls without a scrollbar of its own', () => {
    // Both engines or neither. A touch scrollbar is an overlay that fades; a
    // desktop window narrowed past `sm` otherwise gets a permanent 15px slab
    // between the tabs and the section under them.
    expect(row.has('[scrollbar-width:none]')).toBe(true)
    expect(row.has('[&::-webkit-scrollbar]:hidden')).toBe(true)
  })

  it('bleeds that row to the pane edges while keeping the page inset', () => {
    // Both halves or neither: a bleed whose padding went missing is what
    // puts the first tab flush against the screen edge.
    for (const cls of ['-mx-4', 'px-4', 'sm:-mx-8', 'sm:px-8']) {
      expect(row.has(cls)).toBe(true)
    }
  })

  it('keeps a revealed tab off the edge when there is room', () => {
    // scroll-padding, so `scrollIntoView` and arrow-key movement stop short of
    // the inset instead of aligning to the padding box.
    expect(row.has('scroll-px-4')).toBe(true)
    expect(row.has('sm:scroll-px-8')).toBe(true)
  })

  it('keeps a 44px touch target on the tabs for coarse pointers', () => {
    expect(row.has('pointer-coarse:[&_button]:min-h-11')).toBe(true)
  })

  it('insets the scrolling column, so no field sits on the screen edge', () => {
    expect(shell).toMatch(/mx-auto w-full max-w-3xl px-4[^"]*sm:px-8/)
  })

  it('aligns the header with the column beneath it', () => {
    // The header used to run `px-4 sm:px-0` against a column with no padding
    // at all, which put the title 16px inside fields that started at 0.
    const insets = shell.match(/mx-auto w-full max-w-3xl px-4[^"]*/g) ?? []

    expect(insets.length).toBeGreaterThanOrEqual(2)
    expect(new Set(insets.map((cls) => cls.includes('sm:px-8'))).size).toBe(1)
  })

  it('leaves the column room to scroll past its last row', () => {
    expect(shell).toMatch(/max-w-3xl px-4 py-6 sm:px-8 md:py-8/)
  })

  it('reserves the scrollbar gutter, so sections do not shift under each other', () => {
    // Only some sections are tall enough to scroll — Profile is, Appearance is
    // not — so without a reserved gutter a 15px scrollbar appears and vanishes
    // between tabs, re-centering `mx-auto` and sliding the whole column 7.5px.
    // `both-edges` keeps the box symmetric so the column stays on the header's
    // axis; `md:` because that is where the column starts being centered.
    expect(shell).toContain('md:[scrollbar-gutter:stable_both-edges]')
  })

  for (const [name, path] of [
    ['account', ACCOUNT_ROUTE],
    ['workspace', WORKSPACE_ROUTE],
  ] as const) {
    it(`routes ${name} settings through the shared shell`, () => {
      const source = readFileSync(path, 'utf8')

      expect(source).toContain('<SettingsShell')
      // A route that grows its own pane header is a second copy of everything
      // above, which is the drift this component exists to end.
      expect(source).not.toContain('<AppPane')
      expect(source).not.toContain('<TabList')
    })
  }
})
