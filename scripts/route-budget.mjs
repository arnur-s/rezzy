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
 *   node scripts/route-budget.mjs dev    # against `pnpm dev` on :3000
 *   node scripts/route-budget.mjs prod   # against `vite preview` on :3411
 *
 * For a trustworthy dev number, start the server with `--force`. Vite serves
 * partially re-optimized dependencies while it rebuilds its cache, which
 * inflates the request count for reasons unrelated to the app's imports.
 *
 * Exits non-zero if a budget is exceeded, so this can gate a regression.
 */
import { chromium } from 'playwright'

const MODE = process.argv[2] === 'prod' ? 'prod' : 'dev'
const BASE =
  process.env.BASE_URL ??
  (MODE === 'prod' ? 'http://127.0.0.1:3411' : 'http://127.0.0.1:3000')

/**
 * Budgets chosen just above the values measured after removing the
 * `lucide-react/dynamic` barrel and lazy-loading emoji-mart and lottie. They
 * are ceilings to catch a regression, not targets to fill.
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

const browser = await chromium.launch()
const page = await browser.newContext().then((c) => c.newPage())
const cdp = await page.context().newCDPSession(page)
await cdp.send('Network.enable')
if (MODE === 'prod') await cdp.send('Network.emulateNetworkConditions', THROTTLE)

const urlByRequest = new Map()
let files = []

cdp.on('Network.requestWillBeSent', (e) => urlByRequest.set(e.requestId, e.request.url))
cdp.on('Network.loadingFinished', (e) => {
  const url = urlByRequest.get(e.requestId)
  if (!url || (!url.includes('.js') && !url.includes('/src/'))) return
  files.push([url.replace(BASE, ''), e.encodedDataLength])
})

function measure(label, wall) {
  const bytes = files.reduce((sum, [, n]) => sum + n, 0)
  const result = { label, wall, count: files.length, kb: bytes / 1024, files: [...files] }
  files = []
  return result
}

function print(r) {
  console.log(`\n=== ${r.label} ===`)
  console.log(`  wall ${r.wall.toFixed(0)}ms | ${r.count} requests | ${r.kb.toFixed(0)} kB JS`)
  for (const [name, len] of [...r.files].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.log(`    ${(len / 1024).toFixed(1).padStart(7)} kB  ${name.slice(0, 84)}`)
  }
}

console.log(`mode: ${MODE}  base: ${BASE}`)

let t = performance.now()
await page.goto(BASE, { waitUntil: 'networkidle' })
const boot = measure(`cold load -> ${new URL(page.url()).pathname}`, performance.now() - t)
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

await browser.close()

const failures = []
if (MODE === 'dev' && boot.count > BUDGETS.dev.bootRequests) {
  failures.push(`boot made ${boot.count} module requests, budget ${BUDGETS.dev.bootRequests}`)
}
if (MODE === 'prod' && boot.kb > BUDGETS.prod.bootKb) {
  failures.push(`boot transferred ${boot.kb.toFixed(0)} kB, budget ${BUDGETS.prod.bootKb} kB`)
}

if (failures.length) {
  console.error('\nBUDGET EXCEEDED:')
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}
console.log('\nWithin budget.')
