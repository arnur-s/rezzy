/**
 * Shell screenshots for iterating on the app frame.
 *
 * The shell's structure — canvas, pane insets, elevation, gaps — is a layout
 * property, and jsdom has no layout, so the unit suite cannot see any of it.
 * This drives the running dev server (or a built preview) with the same fake
 * session the smoke check uses and captures the routes where the shell is
 * actually visible, at desktop, tablet, and phone width in both colour modes.
 *
 * Usage:
 *   pnpm dev:agent                       # in another terminal
 *   BASE_URL=http://127.0.0.1:3000 node scripts/shell-shots.mjs [label]
 *
 * Output: .screenshots/shell/<label>/<route>-<mode>-<width>.png
 */
import { WORKSPACE_ID, installFakeAuth } from './fake-auth.mjs'
import { hasBuild, serveDist } from './serve-dist.mjs'
import { mkdirSync, rmSync } from 'node:fs'
import { chromium } from 'playwright'
import path from 'node:path'
import process from 'node:process'

const PORT = 4175
const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`
const OWNS_SERVER = !process.env.BASE_URL
const LABEL = process.argv[2] ?? 'current'
const OUT_DIR = path.join('.screenshots', 'shell', LABEL)

/** Desktop is where the multi-pane frame is fully expressed; the narrower two
 *  are where a gap or an inset most easily eats the usable width. */
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 900, height: 800 },
  { name: 'phone', width: 390, height: 844 },
]

const ROUTES = [
  ['home', '/'],
  ['inbox', `/workspaces/${WORKSPACE_ID}/inbox`],
  ['workspace', `/workspaces/${WORKSPACE_ID}`],
  ['workspace-settings', `/workspaces/${WORKSPACE_ID}/settings`],
  ['workspace-channels', `/workspaces/${WORKSPACE_ID}/settings/channels`],
  ['contacts', `/workspaces/${WORKSPACE_ID}/contacts`],
  ['settings-appearance', '/settings/appearance'],
  ['sign-in', '/sign-in'],
]

if (OWNS_SERVER && !hasBuild()) {
  console.error('No dist/ build found. Run `pnpm build` first, or set BASE_URL.')
  process.exit(1)
}

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })

const server = OWNS_SERVER ? await serveDist(PORT) : null
const browser = await chromium.launch()

try {
  for (const mode of ['light', 'dark']) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: mode,
        locale: 'ru',
      })
      const page = await context.newPage()
      await installFakeAuth(page, BASE, { language: 'ru' })
      await context.addCookies([
        { name: 'PARAGLIDE_LOCALE', value: 'ru', url: BASE },
      ])

      for (const [name, route] of ROUTES) {
        await page.goto(BASE + route, { waitUntil: 'networkidle' })
        await page.waitForTimeout(500)
        await page.screenshot({
          path: path.join(OUT_DIR, `${name}-${mode}-${viewport.name}.png`),
        })
      }
      console.log(`${mode}/${viewport.name}: ${ROUTES.length} routes`)
      await context.close()
    }
  }
} finally {
  await browser.close()
  server?.close()
}

console.log(`\nScreenshots in ${OUT_DIR}/`)
