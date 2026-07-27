/**
 * Smoke check: loads the built app in a real browser and fails on any console
 * error, uncaught exception, failed request, or route that renders nothing.
 *
 * The unit suite runs in jsdom, which cannot see the failures this change class
 * actually risks: a rejected `React.lazy` boundary, a chunk that 404s after
 * re-chunking, or a module that evaluates out of order. Those only appear when
 * a real browser executes the real bundle.
 *
 * Covers authenticated routes too, using a seeded fake session and stubbed API
 * (scripts/fake-auth.mjs). The public routes are the only ones reachable
 * without credentials, but the workspace dashboard, inbox and settings are
 * where the icons render and the route gates run, so checking only the signed
 * out shell would leave the riskiest paths unverified.
 *
 * Usage: `pnpm build && pnpm smoke`
 * Point BASE_URL at an already-running server to skip the built-in one.
 */
import { WORKSPACE_ID, installFakeAuth } from './fake-auth.mjs'
import { hasBuild, serveDist } from './serve-dist.mjs'
import { chromium } from 'playwright'
import process from 'node:process'

const PORT = 4173
const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`
const OWNS_SERVER = !process.env.BASE_URL

/** Reachable signed out; authenticated ones redirect here. */
const PUBLIC_ROUTES = ['/', '/sign-in', '/sign-up', '/password-reset', '/onboarding']

/** Reached only with a session. `expect` is the path we should land on. */
const PRIVATE_ROUTES = [
  { path: '/', expect: '/' },
  { path: '/settings/profile', expect: '/settings/profile' },
  { path: '/settings/appearance', expect: '/settings/appearance' },
  { path: '/settings/notifications', expect: '/settings/notifications' },
  { path: '/settings/security', expect: '/settings/security' },
  { path: `/workspaces/${WORKSPACE_ID}`, expect: `/workspaces/${WORKSPACE_ID}` },
  { path: `/workspaces/${WORKSPACE_ID}/inbox`, expect: null },
  { path: `/workspaces/${WORKSPACE_ID}/settings`, expect: null },
  { path: `/workspaces/${WORKSPACE_ID}/contacts`, expect: null },
]

if (OWNS_SERVER && !hasBuild()) {
  console.error('No dist/ build found. Run `pnpm build` first.')
  process.exit(1)
}

const server = OWNS_SERVER ? await serveDist(PORT) : null
const browser = await chromium.launch()
const problems = []

/** Attaches the failure listeners every page share. */
function watch(page, label) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    // Auth calls fail by design when signed out; that is the environment, not
    // the bundle.
    if (/supabase\.co|Failed to load resource.*40[13]/.test(text)) return
    problems.push(`[${label}] console.error: ${text}`)
  })
  page.on('pageerror', (err) => problems.push(`[${label}] uncaught: ${err.message}`))
  page.on('requestfailed', (req) => {
    const url = req.url()
    // Realtime is deliberately aborted by the auth stub.
    if (url.includes('supabase.co') || url.includes('realtime')) return
    problems.push(`[${label}] request failed: ${url} (${req.failure()?.errorText})`)
  })
}

async function visit(page, label, path, expected) {
  const before = problems.length
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  // Route gates resolve a tick after load; let the redirect settle.
  await page.waitForTimeout(400)

  const landed = new URL(page.url()).pathname
  const rendered = await page.evaluate(
    () => (document.getElementById('app')?.textContent ?? '').trim().length > 0,
  )
  if (!rendered) problems.push(`[${label}] ${path}: #app rendered nothing`)
  if (expected && landed !== expected) {
    problems.push(`[${label}] ${path}: expected to land on ${expected}, got ${landed}`)
  }

  const status = problems.length === before ? 'ok' : 'PROBLEM'
  console.log(`${status.padEnd(8)} ${label.padEnd(6)} ${path.padEnd(46)} -> ${landed}`)
}

try {
  const publicPage = await browser.newContext().then((c) => c.newPage())
  watch(publicPage, 'public')
  for (const path of PUBLIC_ROUTES) await visit(publicPage, 'public', path, null)

  const authContext = await browser.newContext()
  const authPage = await authContext.newPage()
  watch(authPage, 'auth')
  await installFakeAuth(authPage, BASE)
  for (const { path, expect } of PRIVATE_ROUTES) {
    await visit(authPage, 'auth', path, expect)
  }

  // Guards against a false green: if the fake session were silently rejected,
  // every route above would still "render something" (the sign-in page). These
  // assert the signed-in shell specifically, and that the static icon map that
  // replaced DynamicIcon actually draws.
  await authPage.goto(`${BASE}/workspaces/${WORKSPACE_ID}`, { waitUntil: 'networkidle' })
  await authPage.waitForTimeout(600)

  const body = await authPage.evaluate(() => document.body.innerText)
  if (!body.includes('Smoke Workspace')) {
    problems.push('[auth] the workspace fixture never rendered; the session was not accepted')
  }

  // The specific glyph, not a count of every svg: the design system draws
  // ~30 icons of its own, which would mask the workspace icon disappearing.
  // The fixture sets 'rocket', so anything else means the map is broken.
  const workspaceIcon = await authPage.evaluate(
    () => document.querySelector('[data-workspace-icon]')?.getAttribute('data-workspace-icon') ?? null,
  )
  if (workspaceIcon !== 'rocket') {
    problems.push(
      `[auth] expected the workspace icon map to draw 'rocket', got ${workspaceIcon ?? 'nothing'}`,
    )
  }
  console.log(`\nsigned-in shell: workspace fixture rendered, icon map drew '${workspaceIcon}'`)
} finally {
  await browser.close()
  server?.close()
}

if (problems.length) {
  console.error('\nSmoke check failed:')
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}
console.log('\nAll routes rendered with no console errors.')
