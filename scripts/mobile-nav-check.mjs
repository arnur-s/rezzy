/**
 * Checks the mobile navigation drawer at phone width.
 *
 * `AppShell`'s `mobileNav.content` slot is rendered raw, outside the drawer
 * chrome, so passing a second `<Sidebar>` there laid a full copy of the rail
 * into the page flow below the content on every phone-width load: two brand
 * marks and two nav trees stacked down the screen. Nothing caught it, because
 * the route still rendered and the console stayed clean.
 *
 * The assertion is the shape rather than the existence: the rail must not be
 * laid out while the drawer is closed, the toggle must open it, and the opened
 * drawer must carry the real navigation.
 *
 * Usage: pnpm build && pnpm check:mobile-nav
 */
import { WORKSPACE_ID, installFakeAuth } from './fake-auth.mjs'
import { hasBuild, serveDist } from './serve-dist.mjs'
import { chromium } from 'playwright'
import process from 'node:process'

const PORT = 4180
const BASE = `http://127.0.0.1:${PORT}`

if (!hasBuild()) {
  console.error('No dist/ build found. Run `pnpm build` first.')
  process.exit(1)
}

const server = await serveDist(PORT)
const browser = await chromium.launch()
const problems = []

const ROUTES = [
  ['home', '/'],
  ['inbox', `/workspaces/${WORKSPACE_ID}/inbox`],
  ['settings', '/settings/profile'],
]

const VIEWPORT = { width: 390, height: 844 }

/**
 * How many copies of the rail are laid out right now, counted by its brand
 * mark. Astryx renders the drawer as a `<dialog>` with no `<nav>`, so the mark
 * is the reliable signal: one on screen is correct, two means a second rail is
 * sitting in the page flow.
 */
const visibleBrandMarks = (page) =>
  page.evaluate(
    () =>
      Array.from(document.querySelectorAll('*')).filter((el) => {
        if (el.children.length > 0) return false
        if (el.textContent?.trim() !== 'Rezzy') return false
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }).length,
  )

try {
  for (const locale of ['ru', 'en']) {
    const context = await browser.newContext({ viewport: VIEWPORT, locale })
    await context.addCookies([
      { name: 'PARAGLIDE_LOCALE', value: locale, url: BASE },
    ])
    const page = await context.newPage()
    await installFakeAuth(page, BASE, { language: locale })

    for (const [label, route] of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' })
      await page.waitForTimeout(700)

      const closedMarks = await visibleBrandMarks(page)
      if (closedMarks > 1) {
        problems.push(
          `[${locale}] ${label}: ${closedMarks} rails laid out with the drawer ` +
            `closed — a copy is leaking into the page flow`,
        )
      }

      // Addressed by accessible name, not DOM order: the page mounts closed
      // dialogs whose buttons come first in the document.
      const toggle = page.getByRole('button', { name: /navigation|навигац/i })
      let opened = false
      try {
        await toggle.first().click({ timeout: 3000 })
        await page.waitForTimeout(600)
        opened = await page.evaluate(() => {
          const drawer = document.querySelector('dialog[class*="mobile-nav"]')
          if (!drawer?.open) return false
          const rect = drawer.getBoundingClientRect()
          // The drawer has to actually carry the navigation, not just open.
          const hasDestinations =
            drawer.querySelectorAll('a[href], button').length > 3
          return rect.width > 0 && rect.height > 0 && hasDestinations
        })
      } catch {
        opened = false
      }

      if (!opened) {
        problems.push(
          `[${locale}] ${label}: the drawer did not open with navigation in it`,
        )
      }

      console.log(
        `${locale} ${label}: ${closedMarks} rail(s) while closed, ` +
          `${opened ? 'drawer opens with nav' : 'DRAWER BROKEN'}`,
      )
    }

    await context.close()
  }
} finally {
  await browser.close()
  server.close()
}

if (problems.length) {
  console.error('\nMobile nav check failed:')
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log('\nMobile navigation stays in its drawer and opens on demand.')
