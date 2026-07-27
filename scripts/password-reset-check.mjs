/**
 * Exercises both halves of the password-reset route in a real browser.
 *
 * `pnpm smoke` proves the route renders; it cannot prove the flow works. The
 * paths that matter here are only reachable by driving it: a Zod message
 * appears only after an invalid submit, and the set-new-password pane appears
 * only when the page load carries a recovery link. The second one shipped
 * broken precisely because nothing exercised it — Supabase consumes the
 * recovery fragment during boot and emits `PASSWORD_RECOVERY` before this
 * code-split route can subscribe, so the pane never appeared for a user who
 * had just clicked the emailed link.
 *
 * Supabase is stubbed: nothing leaves the machine and no email is sent.
 *
 * Usage: pnpm build && pnpm check:password-reset
 */
import { hasBuild, serveDist } from './serve-dist.mjs'
import { chromium } from 'playwright'
import process from 'node:process'

const PORT = 4175
const BASE = `http://127.0.0.1:${PORT}`

if (!hasBuild()) {
  console.error('No dist/ build found. Run `pnpm build` first.')
  process.exit(1)
}

const server = await serveDist(PORT)
const browser = await chromium.launch()
const problems = []

/** Latin runs of 4+ that are not a brand name or the fixture address. */
function englishLeak(text) {
  const cleaned = text
    .replace(/someone@example\.test/g, '')
    .replace(/Rezzy|Telegram|WhatsApp|Instagram|Email|email|Smoke Workspace|Smoke Tester/g, '')
  return cleaned.match(/[A-Za-z]{4,}/g) ?? []
}

async function newPage(locale) {
  const context = await browser.newContext({ locale })
  await context.addCookies([
    { name: 'PARAGLIDE_LOCALE', value: locale, url: BASE },
  ])
  const page = await context.newPage()
  return { context, page }
}

/** The request half: validate, send once, confirm. */
async function checkRequestHalf(locale) {
  const { context, page } = await newPage(locale)
  let resetCalls = 0

  await page.route('**/*.supabase.co/**', async (route) => {
    if (new URL(route.request().url()).pathname.includes('/auth/v1/recover')) {
      resetCalls += 1
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '{}',
    })
  })

  await page.goto(`${BASE}/password-reset`, { waitUntil: 'networkidle' })

  await page.fill('input[type="email"]', 'not-an-email')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(300)

  const afterInvalid = await page.evaluate(() => document.body.innerText)
  if (locale === 'ru') {
    if (!/[А-Яа-яЁё]/.test(afterInvalid)) {
      problems.push(`[ru request] validation error did not render in Russian`)
    }
    const leaks = englishLeak(afterInvalid)
    if (leaks.length > 0) {
      problems.push(`[ru request] English on the page: ${leaks.join(', ')}`)
    }
  }
  if (resetCalls !== 0) {
    problems.push(`[${locale} request] invalid address still called Supabase`)
  }

  await page.fill('input[type="email"]', 'someone@example.test')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(600)

  if (resetCalls !== 1) {
    problems.push(`[${locale} request] expected 1 recover call, got ${resetCalls}`)
  }
  const sent = await page.evaluate(() => document.body.innerText)
  if (!sent.includes('someone@example.test')) {
    problems.push(`[${locale} request] sent state did not name the address`)
  }
  if (locale === 'ru') {
    const leaks = englishLeak(sent)
    if (leaks.length > 0) {
      problems.push(`[ru request] sent state leaked English: ${leaks.join(', ')}`)
    }
  }

  console.log(`${locale} request: rejected bad address, sent once, confirmed`)
  await context.close()
}

/**
 * The recovery half: arriving from the emailed link. Supabase fires
 * PASSWORD_RECOVERY on the auth client, which is what swaps the pane.
 */
async function checkRecoveryHalf(locale) {
  const { context, page } = await newPage(locale)
  let updateCalls = 0

  await page.route('**/*.supabase.co/**', async (route) => {
    const request = route.request()
    if (
      new URL(request.url()).pathname.includes('/auth/v1/user') &&
      request.method() === 'PUT'
    ) {
      updateCalls += 1
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '{}',
    })
  })

  // A recovery link carries its tokens in the URL fragment; supabase-js reads
  // them on boot and emits PASSWORD_RECOVERY.
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const fragment = [
    'access_token=fake-recovery-token',
    'refresh_token=fake-refresh-token',
    'token_type=bearer',
    `expires_at=${expiresAt}`,
    'expires_in=3600',
    'type=recovery',
  ].join('&')

  await page.goto(`${BASE}/password-reset#${fragment}`, {
    waitUntil: 'networkidle',
  })
  await page.waitForTimeout(900)

  const passwordFields = await page.locator('input[type="password"]').count()
  if (passwordFields !== 2) {
    problems.push(
      `[${locale} recovery] expected 2 password fields, found ${passwordFields}`,
    )
    await context.close()
    return
  }

  // Mismatched confirmation must be caught before anything is sent.
  const fields = page.locator('input[type="password"]')
  await fields.nth(0).fill('correct horse battery')
  await fields.nth(1).fill('different value')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(400)

  if (updateCalls !== 0) {
    problems.push(`[${locale} recovery] mismatched password still called Supabase`)
  }
  const afterMismatch = await page.evaluate(() => document.body.innerText)
  if (locale === 'ru') {
    const leaks = englishLeak(afterMismatch)
    if (leaks.length > 0) {
      problems.push(`[ru recovery] English on the page: ${leaks.join(', ')}`)
    }
  }

  // Matching passwords go through.
  await fields.nth(1).fill('correct horse battery')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(600)

  if (updateCalls !== 1) {
    problems.push(
      `[${locale} recovery] expected 1 update call, got ${updateCalls}`,
    )
  }

  console.log(`${locale} recovery: pane swapped, mismatch blocked, update sent`)
  await context.close()
}

try {
  for (const locale of ['ru', 'en']) {
    await checkRequestHalf(locale)
    await checkRecoveryHalf(locale)
  }
} finally {
  await browser.close()
  server.close()
}

if (problems.length) {
  console.error('\nPassword reset check failed:')
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log('\nBoth halves of password reset work in both locales.')
