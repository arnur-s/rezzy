/**
 * Smoke check: loads the built app in a real browser and fails on any console
 * error, uncaught exception, or failed request.
 *
 * The unit suite runs in jsdom, which cannot see the failures this change class
 * actually risks: a rejected `React.lazy` boundary, a chunk that 404s after
 * re-chunking, or an icon module that evaluates out of order. Those only appear
 * when a real browser executes the real bundle.
 *
 * Usage: `pnpm build && vite preview --port 3411` then
 *        `node scripts/smoke.mjs`
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3411'
/** Routes reachable without a session. Authenticated routes redirect here. */
const ROUTES = ['/', '/sign-in', '/sign-up', '/password-reset', '/onboarding']

const browser = await chromium.launch()
const page = await browser.newContext().then((c) => c.newPage())

const problems = []
page.on('console', (msg) => {
  if (msg.type() !== 'error') return
  const text = msg.text()
  // Supabase auth calls fail without credentials; that is the environment, not
  // the bundle.
  if (/supabase\.co|Failed to load resource.*40[13]/.test(text)) return
  problems.push(`console.error: ${text}`)
})
page.on('pageerror', (err) => problems.push(`uncaught: ${err.message}`))
page.on('requestfailed', (req) => {
  if (req.url().includes('supabase.co')) return
  problems.push(`request failed: ${req.url()} (${req.failure()?.errorText})`)
})

for (const route of ROUTES) {
  const before = problems.length
  await page.goto(BASE + route, { waitUntil: 'networkidle' })

  // An app that throws during render leaves an empty root; assert something
  // actually painted rather than trusting the absence of errors.
  const rendered = await page.evaluate(
    () => (document.getElementById('app')?.textContent ?? '').trim().length > 0,
  )
  if (!rendered) problems.push(`${route}: #app rendered nothing`)

  const status = problems.length === before ? 'ok' : 'PROBLEM'
  console.log(`${status.padEnd(8)} ${route.padEnd(18)} -> ${new URL(page.url()).pathname}`)
}

await browser.close()

if (problems.length) {
  console.error('\nSmoke check failed:')
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}
console.log('\nAll routes rendered with no console errors.')
