/**
 * Screenshots the authenticated routes in both locales so the copy changes can
 * be read as rendered, not just as JSON.
 *
 * Unit tests assert individual strings; they cannot see a Russian sentence
 * overflowing a button, a two-line label where English fits on one, or a plural
 * form that is grammatically right and typographically wrong. This drives the
 * real bundle with the same fake session the smoke check uses.
 *
 * Usage: pnpm build && node scripts/copy-screenshots.mjs
 * Output: .screenshots/<locale>/<route>.png
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
    const dir = path.join(OUT_DIR, locale)
    mkdirSync(dir, { recursive: true })

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale,
    })
    const page = await context.newPage()
    await installFakeAuth(page, BASE, { language: locale })
    // Paraglide resolves the locale from its own cookie before React mounts,
    // and `initLocale` memoizes the result, so the cookie is what actually
    // pins the render language. The Playwright `locale` option only covers the
    // browser-language fallback.
    await context.addCookies([
      { name: 'PARAGLIDE_LOCALE', value: locale, url: BASE },
    ])

    for (const [name, route] of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' })
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(dir, `${name}.png`) })
      console.log(`${locale}  ${route}`)
    }

    await context.close()
  }
} finally {
  await browser.close()
  server?.close()
}

console.log(`\nScreenshots in ${OUT_DIR}/`)
