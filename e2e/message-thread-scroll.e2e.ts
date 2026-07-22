import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import process from 'node:process'
import type { Browser, BrowserContext, Page } from 'playwright'
import { chromium, webkit } from 'playwright'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

/**
 * Real-browser regression tests for the virtualized message transcript.
 * Drives the dev-only harness route (src/routes/e2e-message-list.tsx), which
 * renders MessageList with deterministic in-page data and exposes
 * window.__mtHarness controls.
 */

type HarnessWindowApi = {
  appendInbound: () => string
  appendOwnOutbound: () => string
  appendOtherAgentOutbound: () => string
  redeliverLast: () => void
  updateStatus: (id?: string) => void
  growMessage: (id: string) => void
  prependOlder: (count: number) => void
  setUnread: (dividerId: string | null, hasUnread: boolean) => void
  reselectConversation: () => void
  switchConversation: () => void
  setComposerHeight: (px: number) => void
  getState: () => {
    conversationId: string
    messageIds: Array<string>
    readCommits: Array<string>
  }
}

declare global {
  interface Window {
    __mtHarness?: HarnessWindowApi
    __readCommits?: Array<string>
  }
}

const PORT = 3213
const BASE_URL = `http://127.0.0.1:${PORT}`
const HARNESS_PATH = '/e2e-message-list'
/** Must match SCROLL_END_THRESHOLD in the component; assertions stay well under it. */
const AT_END_EPSILON = 3

let server: ChildProcess

async function waitForServer(url: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) {
      throw new Error(`Dev server did not start at ${url}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

beforeAll(async () => {
  server = spawn(
    'pnpm',
    ['exec', 'vite', 'dev', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: process.cwd(), stdio: 'ignore' },
  )
  await waitForServer(BASE_URL + HARNESS_PATH)
})

afterAll(() => {
  server.kill('SIGTERM')
})

type Metrics = {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  distanceFromEnd: number
}

const SCROLLER = '[data-testid="harness-root"] [class*="overflow-y-auto"]'

async function openHarness(page: Page, count: number): Promise<void> {
  await page.goto(`${BASE_URL}${HARNESS_PATH}?count=${count}`)
  await page.waitForSelector('[data-testid="message-transcript"]')
}

function metrics(page: Page): Promise<Metrics> {
  return page.$eval(SCROLLER, (el) => ({
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    distanceFromEnd: el.scrollHeight - el.scrollTop - el.clientHeight,
  }))
}

async function expectPinned(page: Page): Promise<void> {
  // Poll longer than the virtualizer's internal scroll-reconcile window (5s)
  // so slow measurement convergence (WebKit) cannot flake the assertion.
  await expect
    .poll(async () => (await metrics(page)).distanceFromEnd, { timeout: 10_000 })
    .toBeLessThanOrEqual(AT_END_EPSILON)
}

async function expectMessageVisible(page: Page, id: string): Promise<void> {
  // The final range can mount a frame after the scroll settles; wait, don't sample.
  await page
    .locator(`[data-message-id="${id}"]`)
    .waitFor({ state: 'visible', timeout: 5_000 })
}

async function scrollTo(page: Page, top: number): Promise<void> {
  // The component releases its bottom pin only for user-initiated scrolling;
  // signal intent with a wheel event before the programmatic scroll.
  await page.$eval(SCROLLER, (el, t) => {
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true }))
    el.scrollTo({ top: t })
  }, top)
  // Let the virtualizer settle its range AND its isScrolling state (150ms
  // reset delay) — WebKit defers measurement corrections while "scrolling".
  await page.waitForTimeout(400)
}

/**
 * Y position of a message's bubble row, for visual-anchor assertions.
 * Measured in-page: Playwright's boundingBox() reports device-scaled
 * coordinates on mobile-emulated WebKit contexts, which skews comparisons.
 */
async function messageY(page: Page, id: string): Promise<number> {
  return page.evaluate((messageId) => {
    const row = document.querySelector(`[data-message-id="${messageId}"]`)
    if (!row) throw new Error(`message ${messageId} is not rendered`)
    return row.getBoundingClientRect().y
  }, id)
}

/** ID of a message row currently visible in the scroller viewport. */
async function visibleMessageId(page: Page): Promise<string> {
  return page.evaluate((scrollerSelector) => {
    const scroller = document.querySelector(scrollerSelector)
    if (!scroller) throw new Error('scroller not found')
    const viewport = scroller.getBoundingClientRect()
    const rows = Array.from(document.querySelectorAll('[data-message-id]'))
    for (const row of rows) {
      const box = row.getBoundingClientRect()
      if (box.top >= viewport.top + 40 && box.bottom <= viewport.bottom - 40) {
        return row.getAttribute('data-message-id') ?? ''
      }
    }
    throw new Error('no fully visible message row')
  }, SCROLLER)
}

function harness(page: Page) {
  return {
    appendInbound: () =>
      page.evaluate(() => window.__mtHarness!.appendInbound()),
    appendOwnOutbound: () =>
      page.evaluate(() => window.__mtHarness!.appendOwnOutbound()),
    appendOtherAgentOutbound: () =>
      page.evaluate(() => window.__mtHarness!.appendOtherAgentOutbound()),
    redeliverLast: () =>
      page.evaluate(() => window.__mtHarness!.redeliverLast()),
    updateStatus: (id?: string) =>
      page.evaluate((mid) => window.__mtHarness!.updateStatus(mid), id),
    growMessage: (id: string) =>
      page.evaluate((mid) => window.__mtHarness!.growMessage(mid), id),
    prependOlder: (count: number) =>
      page.evaluate((n) => window.__mtHarness!.prependOlder(n), count),
    reselectConversation: () =>
      page.evaluate(() => window.__mtHarness!.reselectConversation()),
    switchConversation: () =>
      page.evaluate(() => window.__mtHarness!.switchConversation()),
    setComposerHeight: (px: number) =>
      page.evaluate((h) => window.__mtHarness!.setComposerHeight(h), px),
    readCommits: () => page.evaluate(() => window.__readCommits ?? []),
  }
}

function newMessagesButton(page: Page) {
  return page.getByRole('button', { name: /new message|новое|новых|новые/i })
}

function runScrollSuite(
  browserName: 'chromium' | 'webkit',
  launch: () => Promise<Browser>,
) {
  describe(`message thread scrolling (${browserName})`, () => {
    let browser: Browser
    let context: BrowserContext
    let page: Page

    beforeAll(async () => {
      browser = await launch()
    })

    afterAll(async () => {
      await browser.close()
    })

    afterEach(async () => {
      await context.close()
    })

    async function newPage(viewport = { width: 900, height: 720 }) {
      context = await browser.newContext({ viewport })
      page = await context.newPage()
      return page
    }

    it('opens a short thread resting at the bottom above the composer', async () => {
      await newPage()
      await openHarness(page, 3)

      const m = await metrics(page)
      // No overflow: the transcript is shorter than the viewport …
      expect(m.scrollHeight).toBeLessThanOrEqual(m.clientHeight + 1)

      // … and the last message rests against the bottom, not the top.
      const scrollerBox = await page.locator(SCROLLER).boundingBox()
      const lastBox = await page.locator('[data-message-id="m-1002"]').boundingBox()
      if (!scrollerBox || !lastBox) throw new Error('missing layout boxes')
      const gapBelowLast = scrollerBox.y + scrollerBox.height - (lastBox.y + lastBox.height)
      expect(gapBelowLast).toBeLessThanOrEqual(80)
    })

    it('opens a long thread at the latest message with virtualization active', async () => {
      await newPage()
      await openHarness(page, 400)
      await expectPinned(page)

      // The newest message is on screen; the oldest is virtualized out.
      await expectMessageVisible(page, 'm-1399')
      expect(await page.locator('[data-message-id="m-1000"]').count()).toBe(0)
    })

    it('follows appended messages while pinned and commits the read cursor once', async () => {
      await newPage()
      await openHarness(page, 400)
      await expectPinned(page)

      const h = harness(page)
      const id = await h.appendInbound()
      await expectPinned(page)
      await expectMessageVisible(page, id)

      await expect.poll(() => h.readCommits()).toContain(id)

      // A status-only update must not move the viewport or re-commit.
      const before = await metrics(page)
      const commitsBefore = (await h.readCommits()).length
      await h.updateStatus(id)
      await page.waitForTimeout(250)
      const after = await metrics(page)
      expect(Math.abs(after.scrollTop - before.scrollTop)).toBeLessThanOrEqual(1)
      expect((await h.readCommits()).length).toBe(commitsBefore)
    })

    it('does not move the viewport when inbound arrives while reading history', async () => {
      await newPage()
      await openHarness(page, 400)
      await expectPinned(page)

      const mid = (await metrics(page)).scrollHeight / 2
      await scrollTo(page, mid)
      const anchorId = await visibleMessageId(page)
      const anchorYBefore = await messageY(page, anchorId)
      const topBefore = (await metrics(page)).scrollTop

      const h = harness(page)
      await h.appendInbound()
      await page.waitForTimeout(300)

      expect(Math.abs((await metrics(page)).scrollTop - topBefore)).toBeLessThanOrEqual(1)
      expect(Math.abs((await messageY(page, anchorId)) - anchorYBefore)).toBeLessThanOrEqual(1)
      // No read commit while the new message stays unread.
      expect(await h.readCommits()).toEqual([])
    })

    it('shows the new-messages button with a unique, accurate count', async () => {
      await newPage()
      await openHarness(page, 400)
      await expectPinned(page)
      await scrollTo(page, 500)

      const h = harness(page)
      await h.appendInbound()
      await h.appendInbound()
      await h.appendOtherAgentOutbound()
      // Duplicate delivery and status churn must not inflate the count.
      await h.redeliverLast()
      await h.updateStatus()

      await expect
        .poll(() => newMessagesButton(page).textContent(), { timeout: 5_000 })
        .toMatch(/3/)
    })

    it('pressing the button reaches the end, clears it, and commits the read cursor', async () => {
      await newPage()
      await openHarness(page, 400)
      await expectPinned(page)
      await scrollTo(page, 500)

      const h = harness(page)
      const lastId = await h.appendInbound()
      await newMessagesButton(page).waitFor()

      await newMessagesButton(page).click()
      await expectPinned(page)
      await expect
        .poll(() => newMessagesButton(page).count(), { timeout: 5_000 })
        .toBe(0)
      await expect.poll(() => h.readCommits()).toContain(lastId)
    })

    it('returns to the end when the current user sends while reading history', async () => {
      await newPage()
      await openHarness(page, 400)
      await expectPinned(page)
      await scrollTo(page, 500)

      const h = harness(page)
      // An interrupting message first, so a pending count exists to clear.
      await h.appendInbound()
      await newMessagesButton(page).waitFor()

      const sentId = await h.appendOwnOutbound()
      await expectPinned(page)
      await expectMessageVisible(page, sentId)
      await expect
        .poll(() => newMessagesButton(page).count(), { timeout: 5_000 })
        .toBe(0)
    })

    it('preserves the visible anchor when older history is prepended', async () => {
      await newPage()
      await openHarness(page, 400)
      await expectPinned(page)
      await scrollTo(page, 300)

      const anchorId = await visibleMessageId(page)
      const anchorYBefore = await messageY(page, anchorId)

      const h = harness(page)
      await h.prependOlder(40)
      await page.waitForTimeout(400)

      expect(Math.abs((await messageY(page, anchorId)) - anchorYBefore)).toBeLessThanOrEqual(1)
      expect(await newMessagesButton(page).count()).toBe(0)
    })

    it('keeps the historical anchor when content above the viewport grows', async () => {
      await newPage()
      await openHarness(page, 400)
      await expectPinned(page)

      const mid = (await metrics(page)).scrollHeight / 2
      await scrollTo(page, mid)
      const anchorId = await visibleMessageId(page)
      const anchorYBefore = await messageY(page, anchorId)

      // Grow a rendered message above the fold (simulated media load): close
      // enough to be in the overscan range so it actually re-measures.
      const aboveId = `m-${Number(anchorId.slice(2)) - 4}`
      const h = harness(page)
      await h.growMessage(aboveId)
      await page.waitForTimeout(500)

      expect(Math.abs((await messageY(page, anchorId)) - anchorYBefore)).toBeLessThanOrEqual(1)
    })

    it('stays pinned when the final message grows after render', async () => {
      await newPage()
      await openHarness(page, 400)
      await expectPinned(page)

      await harness(page).growMessage('m-1399')
      await expectPinned(page)
      await expectMessageVisible(page, 'm-1399')
    })

    it('reselecting the conversation returns to the end', async () => {
      await newPage()
      await openHarness(page, 400)
      await expectPinned(page)
      await scrollTo(page, 400)

      await harness(page).reselectConversation()
      await expectPinned(page)
    })

    it('switching conversations resets scroll state and opens the new thread at its end', async () => {
      await newPage()
      await openHarness(page, 400)
      await expectPinned(page)
      await scrollTo(page, 400)
      const h = harness(page)
      await h.appendInbound()
      await newMessagesButton(page).waitFor()

      await h.switchConversation()
      await page.waitForSelector('[data-testid="message-transcript"]')
      await expectPinned(page)
      expect(await newMessagesButton(page).count()).toBe(0)
    })

    it('keeps the latest content visible when the composer grows and the pane narrows', async () => {
      await newPage()
      await openHarness(page, 400)
      await expectPinned(page)

      await harness(page).setComposerHeight(220)
      await expectPinned(page)

      await page.setViewportSize({ width: 520, height: 720 })
      await expectPinned(page)
      await expectMessageVisible(page, 'm-1399')
    })
  })
}

runScrollSuite('chromium', () => chromium.launch())

// WebKit focuses on the behaviors where its scroll handling differs:
// initial positioning, follow-on-append, and measurement corrections while
// the user is reading history (must not yank or interrupt scrolling).
describe('message thread scrolling (webkit specifics)', () => {
  let browser: Browser
  let context: BrowserContext
  let page: Page

  beforeAll(async () => {
    browser = await webkit.launch()
  })

  afterAll(async () => {
    await browser.close()
  })

  afterEach(async () => {
    await context.close()
  })

  it('opens at the end, follows appends, and leaves historical reading undisturbed', async () => {
    context = await browser.newContext({
      viewport: { width: 390, height: 720 },
      hasTouch: true,
      isMobile: true,
    })
    page = await context.newPage()
    await openHarness(page, 400)
    await expectPinned(page)

    const h = harness(page)
    const id = await h.appendInbound()
    await expectPinned(page)
    await expectMessageVisible(page, id)

    // Scroll into history, then grow a message above the viewport while
    // "reading" — the anchor must not shift under WebKit's deferred
    // adjustment handling.
    const mid = (await metrics(page)).scrollHeight / 2
    await scrollTo(page, mid)
    const anchorId = await visibleMessageId(page)
    const anchorYBefore = await messageY(page, anchorId)
    await h.growMessage(`m-${Number(anchorId.slice(2)) - 4}`)
    await page.waitForTimeout(500)
    await h.appendInbound()
    await page.waitForTimeout(500)

    // On iOS UAs the virtualizer defers scroll corrections while it believes a
    // scroll or touch is in flight and flushes them on the next interaction.
    // A real device always has a next touch; synthesize one so a correction
    // deferred by test-timing races cannot leave the assertion hanging.
    await page.$eval(SCROLLER, (el) => {
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }))
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true }))
    })
    await page.waitForTimeout(400)

    expect(Math.abs((await messageY(page, anchorId)) - anchorYBefore)).toBeLessThanOrEqual(2)
  })
})
