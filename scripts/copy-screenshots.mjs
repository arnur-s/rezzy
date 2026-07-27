/**
 * Screenshots every route in both locales, both colour modes, and at desktop
 * and phone width, so copy can be read as rendered rather than as JSON.
 *
 * Unit tests assert individual strings. They cannot see a Russian sentence
 * overflowing its button, a label that wraps to two lines where English fits on
 * one, or a control sized to the shorter language. jsdom has no layout at all,
 * so this is the only check that can. Russian runs 15-30% longer than English,
 * and the narrow viewport is where that difference actually breaks something.
 *
 * Drives the real bundle with the same fake session the smoke check uses.
 *
 * Usage: pnpm build && pnpm i18n:shots
 * Output: .screenshots/<locale>-<mode>-<width>/<route>.png
 */
import { WORKSPACE_ID, installFakeAuth } from './fake-auth.mjs'
import { hasBuild, serveDist } from './serve-dist.mjs'
import { mkdirSync, rmSync } from 'node:fs'
import { chromium } from 'playwright'
import path from 'node:path'
import process from 'node:process'

const PORT = 4174
const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`
const OWNS_SERVER = !process.env.BASE_URL
const OUT_DIR = '.screenshots'

/** Desktop, and the narrow width where longer copy runs out of room first. */
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]

const MODES = ['light', 'dark']

const ROUTES = [
  ['home', '/'],
  ['sign-in', '/sign-in'],
  ['sign-up', '/sign-up'],
  ['password-reset', '/password-reset'],
  ['onboarding', '/onboarding'],
  ['settings-profile', '/settings/profile'],
  ['settings-appearance', '/settings/appearance'],
  ['settings-notifications', '/settings/notifications'],
  ['settings-security', '/settings/security'],
  ['workspace', `/workspaces/${WORKSPACE_ID}`],
  ['workspace-inbox', `/workspaces/${WORKSPACE_ID}/inbox`],
  ['workspace-settings', `/workspaces/${WORKSPACE_ID}/settings`],
  ['workspace-channels', `/workspaces/${WORKSPACE_ID}/settings/channels`],
  ['workspace-members', `/workspaces/${WORKSPACE_ID}/settings/members`],
  ['workspace-contacts', `/workspaces/${WORKSPACE_ID}/contacts`],
  ['not-found', '/no-such-page'],
]

if (OWNS_SERVER && !hasBuild()) {
  console.error('No dist/ build found. Run `pnpm build` first.')
  process.exit(1)
}

rmSync(OUT_DIR, { recursive: true, force: true })

const server = OWNS_SERVER ? await serveDist(PORT) : null
const browser = await chromium.launch()

try {
  for (const locale of ['ru', 'en']) {
    for (const mode of MODES) {
      for (const viewport of VIEWPORTS) {
        const label = `${locale}-${mode}-${viewport.name}`
        const dir = path.join(OUT_DIR, label)
        mkdirSync(dir, { recursive: true })

        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          locale,
          colorScheme: mode,
        })
        const page = await context.newPage()
        await installFakeAuth(page, BASE, { language: locale })
        // Paraglide resolves the locale from its own cookie before React
        // mounts and memoizes the result, so the cookie is what actually pins
        // the render language; Playwright's `locale` only feeds the
        // browser-language fallback. The theme provider follows the OS
        // preference by default, which `colorScheme` sets.
        await context.addCookies([
          { name: 'PARAGLIDE_LOCALE', value: locale, url: BASE },
        ])

        for (const [name, route] of ROUTES) {
          await page.goto(BASE + route, { waitUntil: 'networkidle' })
          await page.waitForTimeout(400)
          await page.screenshot({ path: path.join(dir, `${name}.png`) })
        }
        console.log(`${label}: ${ROUTES.length} routes`)

        await context.close()
      }
    }
  }
} finally {
  await browser.close()
  server?.close()
}

console.log(`\nScreenshots in ${OUT_DIR}/`)
