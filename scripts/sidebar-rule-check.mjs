/**
 * Checks the sidebar's account row for the rule that should not be there.
 *
 * Astryx's `SideNav` draws a hairline across the top of its footer zone. That
 * zone is the component's own element: it takes no props, carries no stable
 * class, and is not addressable from a theme override, so the only way to reach
 * it is `:has()` hung off the account row's own marker class (see
 * `.sidebar-account-row` in `src/styles.css`).
 *
 * That makes the rule dependent on Astryx's internal DOM shape — specifically
 * on the account row staying a *direct* child of the zone that owns the border.
 * An upgrade that wraps the footer in one more element restores the hairline,
 * and nothing else notices: the route still renders, the console stays clean,
 * typecheck and the unit suite pass, and jsdom cannot see a computed border at
 * all. So the assertion is made here, against the built bundle in a real
 * browser.
 *
 * Both the desktop rail and the mobile drawer render that footer zone, and both
 * are checked, because they are separate branches inside SideNav.
 *
 * Usage: pnpm build && pnpm check:sidebar-rule
 */
import { WORKSPACE_ID, installFakeAuth } from './fake-auth.mjs'
import { hasBuild, serveDist } from './serve-dist.mjs'
import { chromium } from 'playwright'
import process from 'node:process'

const PORT = 4182
const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`
const OWNS_SERVER = !process.env.BASE_URL

const ROUTE = `/workspaces/${WORKSPACE_ID}/inbox`

const DESKTOP = { name: 'desktop', width: 1440, height: 900 }
const PHONE = { name: 'phone', width: 390, height: 844 }

if (OWNS_SERVER && !hasBuild()) {
  console.error('No dist/ build found. Run `pnpm build` first.')
  process.exit(1)
}

/**
 * The account row's ancestry, with the computed top border of each level.
 *
 * Every ancestor up to the nav root is read rather than just the parent: if an
 * upgrade inserts a wrapper, the border moves to a level the `:has()` rule no
 * longer matches, and reporting the whole chain says which level grew it.
 */
function readAccountRowChain() {
  const row = document.querySelector('.sidebar-account-row')
  if (!row) return { error: 'no .sidebar-account-row in the DOM' }

  const chain = []
  let el = row.parentElement
  while (el && chain.length < 6) {
    const style = getComputedStyle(el)
    chain.push({
      tag: el.tagName.toLowerCase(),
      className: String(el.className).slice(0, 120),
      borderTopWidth: parseFloat(style.borderTopWidth) || 0,
      borderTopStyle: style.borderTopStyle,
    })
    if (el.tagName === 'NAV' || el.tagName === 'DIALOG') break
    el = el.parentElement
  }
  return { chain }
}

const server = OWNS_SERVER ? await serveDist(PORT) : null
const browser = await chromium.launch()
const problems = []

try {
  for (const viewport of [DESKTOP, PHONE]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    })
    const page = await context.newPage()
    await installFakeAuth(page, BASE)
    await page.goto(BASE + ROUTE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)

    // At phone width the rail lives in a drawer, so the footer zone only
    // exists once the drawer is open.
    if (viewport === PHONE) {
      const toggle = page.getByRole('button', { name: /navigation|навигац/i })
      await toggle.first().click({ timeout: 5000 })
      await page.waitForTimeout(600)
    }

    const result = await page.evaluate(readAccountRowChain)

    if (result.error) {
      problems.push(`[${viewport.name}] ${result.error}`)
    } else {
      for (const level of result.chain) {
        if (level.borderTopWidth > 0 && level.borderTopStyle !== 'none') {
          problems.push(
            `[${viewport.name}] a rule is back above the account row: ` +
              `${level.borderTopWidth}px ${level.borderTopStyle} on ` +
              `<${level.tag} class="${level.className}">`,
          )
        }
      }
    }

    await context.close()
  }
} finally {
  await browser.close()
  server?.close()
}

if (problems.length) {
  console.error('Sidebar account row:\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\nThe hairline above the account row comes from SideNav\'s footer zone.\n' +
      'It is dropped by the `.sidebar-account-row` rule in src/styles.css, which\n' +
      'reaches that zone with `:has(> …)`. If Astryx now wraps the footer in one\n' +
      'more element, widen the selector to match the new level.',
  )
  process.exit(1)
}

console.log(
  'No rule above the sidebar account row (desktop rail and phone drawer).',
)
