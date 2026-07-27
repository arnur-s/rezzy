/**
 * Checks that overflowing navigation scrolls itself, not the page around it.
 *
 * Russian labels run 15-30% longer than English, so the account settings tabs
 * need 421px where English needs 358. `TabList` lays its tabs in a row but does
 * not scroll them, and the pane above them is `overflow-y-auto` — which, per
 * CSS, also scrolls horizontally. So the last tab was technically reachable:
 * the browser panned the *entire settings pane* sideways to reveal it, dragging
 * the page heading and every form field off screen with it.
 *
 * "Reachable" is therefore the wrong assertion, and passes on the broken build.
 * What matters is that reaching the tab moves only the tab row: this scrolls
 * the last tab into view and then checks the page heading has not moved.
 *
 * Usage: pnpm build && pnpm check:overflow
 */
import { WORKSPACE_ID, installFakeAuth } from './fake-auth.mjs'
import { hasBuild, serveDist } from './serve-dist.mjs'
import { chromium } from 'playwright'
import process from 'node:process'

const PORT = 4176
const BASE = `http://127.0.0.1:${PORT}`

if (!hasBuild()) {
  console.error('No dist/ build found. Run `pnpm build` first.')
  process.exit(1)
}

const server = await serveDist(PORT)
const browser = await chromium.launch()
const problems = []

const ROUTES = [
  ['account settings tabs', '/settings/profile'],
  ['workspace settings tabs', `/workspaces/${WORKSPACE_ID}/settings`],
]

/** Phone width, where the longer language runs out of room first. */
const VIEWPORT = { width: 390, height: 844 }

/**
 * Horizontal position of the tab row's own sibling content.
 *
 * Anchoring on the `h1` does not work: it lives in a separate fixed header
 * outside the scrolling pane, so it stays put even when the pane pans. The
 * anchor has to be inside the same scroll container as the tabs — the
 * description paragraph directly above them.
 */
const anchorX = (page) =>
  page.evaluate(() => {
    const tab = document.querySelector('button[class*="astryx-tab"]')
    const column = tab?.closest('.max-w-3xl')
    const anchor = column?.querySelector('p') ?? column ?? document.body
    return anchor.getBoundingClientRect().left
  })

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
      await page.waitForTimeout(500)

      const tabs = page.locator('button[class*="astryx-tab"]')
      const count = await tabs.count()
      if (count === 0) {
        problems.push(`[${locale}] ${label}: no tabs rendered`)
        continue
      }

      const last = tabs.nth(count - 1)
      const before = await last.evaluate((el) => ({
        right: el.getBoundingClientRect().right,
        text: el.textContent?.trim() ?? '',
      }))
      const overflows = before.right > VIEWPORT.width + 1

      if (!overflows) {
        console.log(`${locale} ${label}: ${count} tabs, fits`)
        continue
      }

      const anchorBefore = await anchorX(page)

      let reachable = true
      try {
        await last.scrollIntoViewIfNeeded({ timeout: 2000 })
        await page.waitForTimeout(250)
        const box = await last.boundingBox()
        reachable =
          box !== null &&
          box.x >= -1 &&
          box.x + box.width <= VIEWPORT.width + 1
      } catch {
        reachable = false
      }

      const anchorAfter = await anchorX(page)
      const drift = Math.abs(anchorAfter - anchorBefore)

      if (!reachable) {
        problems.push(
          `[${locale}] ${label}: "${before.text}" cannot be brought on screen ` +
            `at ${VIEWPORT.width}px`,
        )
      }
      if (drift > 1) {
        problems.push(
          `[${locale}] ${label}: reaching "${before.text}" moved the page ` +
            `content ${Math.round(drift)}px sideways — the tab row needs its ` +
            `own scroll container`,
        )
      }

      if (reachable && drift <= 1) {
        try {
          await last.click({ timeout: 2000 })
          await page.waitForTimeout(300)
        } catch {
          problems.push(`[${locale}] ${label}: "${before.text}" is not clickable`)
        }
      }

      console.log(
        `${locale} ${label}: ${count} tabs, overflows, ` +
          `${reachable ? 'reachable' : 'UNREACHABLE'}, ` +
          `content drift ${Math.round(drift)}px`,
      )
    }

    await context.close()
  }
} finally {
  await browser.close()
  server.close()
}

if (problems.length) {
  console.error('\nOverflow check failed:')
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log('\nOverflowing navigation scrolls itself, not the page.')
