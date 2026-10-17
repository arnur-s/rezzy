import type { ChildProcess } from 'node:child_process'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { localRequestsOnly, startVite } from './server'

/**
 * Real-browser fixture for the shared-contact card, driving the dev-only
 * harness route (src/routes/e2e-shared-contact.tsx).
 *
 * Two things the unit suite structurally cannot check:
 *
 *   - the card's states in a real bundle, with the real Astryx stylesheet;
 *   - whether the Russian copy fits a phone-width message bubble. jsdom has no
 *     layout, so overflow is invisible there, and Russian runs 15-30% longer
 *     than English.
 *
 * No Supabase and no seeded data: the harness primes the query cache, so every
 * state is a URL.
 */

const PORT = 3214
const BASE_URL = `http://127.0.0.1:${PORT}`
const HARNESS_PATH = '/e2e-shared-contact'
/** iPhone SE width — the narrowest phone worth supporting. */
const PHONE = { width: 375, height: 720 }

let server: ChildProcess | undefined
let browser: Browser | undefined

beforeAll(async () => {
  server = await startVite(PORT)
  browser = await chromium.launch()
})

afterAll(async () => {
  await browser?.close()
  server?.kill('SIGTERM')
})

async function openScenario(query: string): Promise<Page> {
  if (!browser) throw new Error('Browser fixture has not started')
  const context = await browser.newContext({ viewport: PHONE })
  await localRequestsOnly(context, PORT)
  const page = await context.newPage()
  await page.goto(`${BASE_URL}${HARNESS_PATH}?${query}`)
  await page.waitForSelector('[data-testid="shared-contact-harness"]')
  return page
}

/** Waits for a control to appear, and reports whether it did. */
async function isVisible(page: Page, name: string | RegExp): Promise<boolean> {
  const locator = page.getByRole('button', { name })
  await locator.first().waitFor({ state: 'visible', timeout: 10_000 })
  return locator.first().isVisible()
}

/** How far the card's content overflows the bubble it sits in, in pixels. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const box = document.querySelector('[data-testid="shared-contact-harness"]')
    if (!box) return 0
    return box.scrollWidth - box.clientWidth
  })
}

describe('shared contact card', () => {
  it('offers to create an unknown contact', async () => {
    const page = await openScenario('scenario=unknown')

    expect(await isVisible(page, 'Create contact')).toBe(true)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    await page.context().close()
  })

  it('offers to open a contact that already exists', async () => {
    const page = await openScenario('scenario=existing')

    expect(await isVisible(page, 'Open contact')).toBe(true)
    expect(
      await page.getByRole('button', { name: 'Create contact' }).count(),
    ).toBe(0)
    await page.context().close()
  })

  it('offers to add a number the matched contact is missing', async () => {
    const page = await openScenario('scenario=incomplete')

    expect(await isVisible(page, 'Add to contact')).toBe(true)
    expect(await isVisible(page, 'Open contact')).toBe(true)
    // Two actions and a sentence, in a bubble as narrow as a phone's.
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    await page.context().close()
  })

  it('stays quiet when the contact already has every number', async () => {
    const page = await openScenario('scenario=existing')

    expect(await isVisible(page, 'Open contact')).toBe(true)
    expect(
      await page.getByRole('button', { name: 'Add to contact' }).count(),
    ).toBe(0)
    await page.context().close()
  })

  it('asks the user to review several credible matches', async () => {
    const page = await openScenario('scenario=duplicate')

    expect(await isVisible(page, 'Review match')).toBe(true)
    await page.getByRole('button', { name: 'Review match' }).click()

    await page.getByText('Possible matches').waitFor({ state: 'visible' })
    expect(await isVisible(page, /D\. Abisheva/)).toBe(true)
    await page.context().close()
  })

  it('says it could not check a number with no country code', async () => {
    const page = await openScenario('scenario=ambiguous')

    await page.getByText(/can’t check the CRM/).waitFor({ state: 'visible' })
    expect(await isVisible(page, 'Copy details')).toBe(true)
    await page.context().close()
  })

  it('checks that same number once the workspace names a country', async () => {
    const page = await openScenario('scenario=ambiguous&region=KZ')

    expect(await isVisible(page, 'Create contact')).toBe(true)
    await page.context().close()
  })

  it('does not flash a create action while the lookup is running', async () => {
    const page = await openScenario('scenario=loading')

    expect(await isVisible(page, /Checking contacts/)).toBe(true)
    expect(
      await page.getByRole('button', { name: 'Create contact' }).count(),
    ).toBe(0)
    await page.context().close()
  })

  it('fits the Russian copy in a phone-width bubble', async () => {
    // The base locale, at the width where its longer strings break layout.
    for (const scenario of [
      'unknown',
      'existing',
      'incomplete',
      'duplicate',
      'ambiguous',
    ]) {
      const page = await openScenario(`locale=ru&scenario=${scenario}`)
      if (scenario === 'unknown') {
        expect(await isVisible(page, 'Создать контакт')).toBe(true)
      }
      expect(
        await horizontalOverflow(page),
        `${scenario} overflows in Russian`,
      ).toBeLessThanOrEqual(1)
      await page.context().close()
    }
  })
})
