/**
 * Route-change cost budget.
 *
 * Answers "why does changing routes take time?" with numbers instead of
 * guesses, by measuring the two places the cost can hide:
 *
 *   dev   - module requests the unbundled dev server must serve. A barrel
 *           import (e.g. an icon set) shows up here as thousands of requests
 *           queued behind the browser's connection limit.
 *   prod  - JS bytes actually transferred per navigation, over a throttled
 *           connection. This is what a user feels.
 *
 * Usage:
 *   pnpm perf:routes        # dev, against `pnpm dev` on :3000
 *   pnpm build && pnpm perf:routes:prod   # prod, serves dist/ itself
 *
 * For a trustworthy dev number, start the dev server with `--force`. Vite
 * serves partially re-optimized dependencies while it rebuilds its cache,
 * which inflates the request count for reasons unrelated to the app's imports.
 *
 * Exits non-zero if a budget is exceeded, so this can gate a regression.
 */
import { WORKSPACE_ID, installFakeAuth } from './fake-auth.mjs'
import { hasBuild, serveDist } from './serve-dist.mjs'
import { chromium } from 'playwright'
import process from 'node:process'

const MODE = process.argv[2] === 'prod' ? 'prod' : 'dev'
const PREVIEW_PORT = 4174
const BASE =
  process.env.BASE_URL ??
  (MODE === 'prod'
    ? `http://127.0.0.1:${PREVIEW_PORT}`
    : 'http://127.0.0.1:3000')
const OWNS_SERVER = MODE === 'prod' && !process.env.BASE_URL

/**
 * Budgets chosen just above the values measured after removing the
 * `lucide-react/dynamic` barrel and lazy-loading emoji-mart and lottie. They
 * are ceilings to catch a regression, not targets to fill.
 *
 * The dev budget counts dependency requests, excluding paraglide's per-message
 * modules: it compiles one ES module per message and the dev server serves each
 * separately, so counting them would make the budget track translation work
 * rather than imports. A barrel import lands in node_modules, which is counted.
 *
 * Measure from a cold `--force` start for the cleanest number: Vite serves
 * partially re-optimized dependencies while it rebuilds its cache. For scale,
 * the `lucide-react/dynamic` barrel this replaced cost 1908 requests in total.
 */
const BUDGETS = {
  dev: { bootRequests: 500 },
  prod: { bootKb: 450 },
}

/** Mid-tier connection, so byte cost surfaces as time rather than hiding on loopback. */
const THROTTLE = {
  offline: false,
  downloadThroughput: (4 * 1024 * 1024) / 8,
  uploadThroughput: (1024 * 1024) / 8,
  latency: 40,
}

if (OWNS_SERVER && !hasBuild()) {
  console.error('No dist/ build found. Run `pnpm build` first.')
  process.exit(1)
}

const server = OWNS_SERVER ? await serveDist(PREVIEW_PORT) : null
const browser = await chromium.launch()

let boot
try {
  const page = await browser.newContext().then((c) => c.newPage())
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  if (MODE === 'prod') await cdp.send('Network.emulateNetworkConditions', THROTTLE)

  const urlByRequest = new Map()
  let files = []

  cdp.on('Network.requestWillBeSent', (e) =>
    urlByRequest.set(e.requestId, e.request.url),
  )
  cdp.on('Network.loadingFinished', (e) => {
    const url = urlByRequest.get(e.requestId)
    if (!url || (!url.includes('.js') && !url.includes('/src/'))) return
    files.push([url.replace(BASE, ''), e.encodedDataLength])
  })

  const measure = (label, wall) => {
    const bytes = files.reduce((sum, [, n]) => sum + n, 0)
    // The budget counts dependency requests only. Paraglide compiles one module
    // per message and the dev server serves each separately, so its count moves
    // with the size of the message catalogue rather than with anything about
    // imports; counting it would make the budget track translation work. A
    // barrel import lands in node_modules, which is exactly what is counted.
    const depCount = files.filter(([name]) => !name.includes('/paraglide/')).length
    const result = {
      label,
      wall,
      count: files.length,
      depCount,
      kb: bytes / 1024,
      files: [...files],
    }
    files = []
    return result
  }

  const print = (r) => {
    console.log(`\n=== ${r.label} ===`)
    console.log(
      `  wall ${r.wall.toFixed(0)}ms | ${r.count} requests (${r.depCount} excluding i18n) | ${r.kb.toFixed(0)} kB JS`,
    )
    for (const [name, len] of [...r.files].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
      console.log(`    ${(len / 1024).toFixed(1).padStart(7)} kB  ${name.slice(0, 84)}`)
    }
  }

  console.log(`mode: ${MODE}  base: ${BASE}`)

  let t = performance.now()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  boot = measure(`cold load -> ${new URL(page.url()).pathname}`, performance.now() - t)
  print(boot)

  // A route change should cost only its own new modules. Public routes exercise
  // the same lazy-route machinery without needing credentials.
  for (const name of [/sign up|создать|регист/i, /sign in|войти/i]) {
    const link = page.getByRole('link', { name }).first()
    if (!(await link.count())) continue
    const from = new URL(page.url()).pathname
    t = performance.now()
    await link.click()
    await page
      .waitForFunction((p) => location.pathname !== p, from, { timeout: 10_000 })
      .catch(() => {})
    await page.waitForLoadState('networkidle')
    print(measure(`${from} -> ${new URL(page.url()).pathname}`, performance.now() - t))
  }

  // The navigations users actually make are behind the auth gate. A fake
  // session (scripts/fake-auth.mjs) reaches them without credentials, so the
  // cost of moving between the dashboard, inbox and settings is measured
  // rather than assumed from the public routes.
  const authPage = await browser.newContext().then((c) => c.newPage())
  const authCdp = await authPage.context().newCDPSession(authPage)
  await authCdp.send('Network.enable')
  if (MODE === 'prod') await authCdp.send('Network.emulateNetworkConditions', THROTTLE)
  authCdp.on('Network.requestWillBeSent', (e) =>
    urlByRequest.set(e.requestId, e.request.url),
  )
  authCdp.on('Network.loadingFinished', (e) => {
    const url = urlByRequest.get(e.requestId)
    if (!url || (!url.includes('.js') && !url.includes('/src/'))) return
    files.push([url.replace(BASE, ''), e.encodedDataLength])
  })

  await installFakeAuth(authPage, BASE)
  // One full load to boot the app, then navigate within it. `page.goto` would
  // reload the document every time and report a cold load rather than the
  // incremental cost of a route change, which is the thing being measured.
  await authPage.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await authPage.waitForTimeout(600)

  /**
   * Clicks a real in-app link, which is the only way to get a router
   * navigation. Injecting a synthetic anchor instead triggers a full document
   * load, which would report a cold boot and hide the number being measured.
   */
  async function clickAuthLink(href) {
    const link = authPage.locator(`a[href="${href}"]`).first()
    if (!(await link.count())) return false
    const from = new URL(authPage.url()).pathname
    files = []
    const t0 = performance.now()
    await link.click()
    await authPage
      .waitForFunction((p) => location.pathname !== p, from, { timeout: 10_000 })
      .catch(() => {})
    await authPage.waitForLoadState('networkidle')
    print(measure(`auth ${from} -> ${new URL(authPage.url()).pathname}`, performance.now() - t0))
    return true
  }

  // The rail is present on every authenticated page, so these are the moves a
  // user actually makes.
  for (const href of [
    `/workspaces/${WORKSPACE_ID}`,
    `/workspaces/${WORKSPACE_ID}/inbox`,
    `/workspaces/${WORKSPACE_ID}/settings`,
    `/workspaces/${WORKSPACE_ID}`,
    '/',
  ]) {
    if (new URL(authPage.url()).pathname === href) continue
    const clicked = await clickAuthLink(href)
    if (!clicked) console.log(`  (skipped ${href}: no in-app link on this page)`)
  }
} finally {
  await browser.close()
  server?.close()
}

const failures = []
if (MODE === 'dev' && boot.depCount > BUDGETS.dev.bootRequests) {
  failures.push(
    `boot made ${boot.depCount} dependency requests, budget ${BUDGETS.dev.bootRequests}`,
  )
}
if (MODE === 'prod' && boot.kb > BUDGETS.prod.bootKb) {
  failures.push(`boot transferred ${boot.kb.toFixed(0)} kB, budget ${BUDGETS.prod.bootKb} kB`)
}

if (failures.length) {
  console.error('\nBUDGET EXCEEDED:')
  for (const f of failures) console.error('  ' + f)
  if (MODE === 'dev') {
    // Worth saying out loud: a stale optimizer cache produces this same
    // failure, and chasing it as an app regression wastes real time.
    console.error(
      '\nIf the dev server has been running across dependency or import changes,\n' +
        'restart it with `--force` and re-measure before treating this as a\n' +
        'regression: Vite serves partially re-optimized deps while it rebuilds.',
    )
  }
  process.exit(1)
}
console.log('\nWithin budget.')
