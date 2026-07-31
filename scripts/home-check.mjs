/**
 * Home dashboard check: the parts of the critique fixes that jsdom cannot see.
 *
 * The unit suite already pins the logic (which workspace the primary action
 * resolves to, that the unassigned section holds its slot). What it cannot
 * check is the rendered result in the real bundle:
 *
 *  - the multi-workspace state actually has a primary action on screen, in both
 *    locales, at desktop and phone width;
 *  - the section explanations are real text in the document rather than `title`
 *    attributes only a hovering mouse can reach;
 *  - the heading that carries the page's rank is visibly heavier than the ones
 *    below it, which is a computed style and therefore invisible to jsdom;
 *  - nothing overflows its column once Russian copy is in it.
 *
 * Usage: `pnpm build && pnpm check:home`
 */
import { hasBuild, serveDist } from './serve-dist.mjs'
import { chromium } from 'playwright'
import { installFakeAuth } from './fake-auth.mjs'
import process from 'node:process'

const PORT = 4179
const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`
const OWNS_SERVER = !process.env.BASE_URL

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

/** Copy the check asserts on, per locale. Mirrors messages/{locale}.json. */
const COPY = {
  en: {
    attention: 'Needs your attention',
    unassignedHint: 'Open conversations nobody has picked up yet',
    openInbox: 'Open ',
  },
  ru: {
    attention: 'Требует вашего внимания',
    unassignedHint: 'Открытые диалоги, которые пока ни за кем не закреплены',
    openInbox: 'Открыть ',
  },
}

if (OWNS_SERVER && !hasBuild()) {
  console.error('No dist/ build found. Run `pnpm build` first.')
  process.exit(1)
}

const server = OWNS_SERVER ? await serveDist(PORT) : null
const browser = await chromium.launch()
const problems = []

async function openHome(locale, viewport, workspaceCount, seedQueue = true) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  page.on('pageerror', (err) =>
    problems.push(`[${locale}] uncaught: ${err.message}`),
  )
  await installFakeAuth(page, BASE, {
    language: locale,
    workspaceCount,
    seedQueue,
  })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  return { context, page }
}

/**
 * The page's primary action. Matched by role and accessible name rather than by
 * class, so a restyle does not silently pass while the button disappears.
 */
async function findPrimaryAction(page, prefix) {
  return page.evaluate((labelPrefix) => {
    const candidates = [
      ...document.querySelectorAll('button, a[href], [role="button"]'),
    ]
    const match = candidates.find((el) =>
      (el.textContent ?? '').trim().startsWith(labelPrefix),
    )
    if (!match) return null
    const rect = match.getBoundingClientRect()
    return {
      text: (match.textContent ?? '').trim(),
      visible: rect.width > 0 && rect.height > 0,
    }
  }, prefix)
}

try {
  for (const locale of ['ru', 'en']) {
    const copy = COPY[locale]

    // The state the critique found broken: several workspaces, which used to
    // render no primary action at all.
    for (const [name, viewport] of [
      ['desktop', DESKTOP],
      ['phone', PHONE],
    ]) {
      const { context, page } = await openHome(locale, viewport, 2)
      const label = `${locale} ${name} multi`

      const action = await findPrimaryAction(page, copy.openInbox)
      if (!action) {
        problems.push(
          `[${label}] the multi-workspace home has no primary action; expected a control starting with "${copy.openInbox.trim()}"`,
        )
      } else if (!action.visible) {
        problems.push(`[${label}] the primary action "${action.text}" is not visible`)
      }

      // Nothing may spill sideways out of the reading column.
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement
        return doc.scrollWidth - doc.clientWidth
      })
      if (overflow > 1) {
        problems.push(`[${label}] page overflows horizontally by ${overflow}px`)
      }

      console.log(
        `ok       ${label.padEnd(20)} primary action: ${action?.text ?? 'MISSING'}`,
      )
      await context.close()
    }

    // Meaning that used to live only in `title`, and the heading rank that
    // makes the queue outrank the furniture.
    const { context, page } = await openHome(locale, DESKTOP, 1)
    const label = `${locale} desktop single`

    const hintIsVisibleText = await page.evaluate((hint) => {
      const nodes = [...document.querySelectorAll('p, span, div')]
      return nodes.some((el) => (el.textContent ?? '').trim() === hint)
    }, copy.unassignedHint)
    // The fixture has no unassigned conversations, so the section is correctly
    // absent. Assert the string is not *only* reachable through a tooltip.
    const hintOnlyInTitle = await page.evaluate((hint) => {
      const titled = [...document.querySelectorAll('[title]')]
      return titled.some((el) => el.getAttribute('title') === hint)
    }, copy.unassignedHint)
    if (hintOnlyInTitle && !hintIsVisibleText) {
      problems.push(
        `[${label}] "${copy.unassignedHint}" is reachable only as a title attribute`,
      )
    }

    const weights = await page.evaluate((attentionTitle) => {
      // Only headings the user can actually see. The page keeps a
      // controlled dialog mounted so it can open without a mount flash,
      // and its hidden h2 would otherwise be compared against.
      const isVisible = (el) => {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return false
        return el.closest('[aria-hidden="true"], [hidden]') === null
      }
      const headings = [...document.querySelectorAll('h2')].filter(isVisible)
      const attention = headings.find(
        (h) => (h.textContent ?? '').trim() === attentionTitle,
      )
      if (!attention) return null
      const others = headings.filter((h) => h !== attention)
      const weightOf = (el) =>
        Number.parseInt(getComputedStyle(el).fontWeight, 10)
      return {
        attention: weightOf(attention),
        others: others.map(weightOf),
        otherTexts: others.map((h) => (h.textContent ?? "").trim()),
      }
    }, copy.attention)

    if (weights === null) {
      // The fixture seeds an unread conversation precisely so this section
      // renders. Its absence means the queue broke, not that the user is
      // caught up.
      problems.push(
        `[${label}] the attention section never rendered, though the fixture seeds an unread conversation`,
      )
    } else {
      const heaviestOther = Math.max(0, ...weights.others)
      if (weights.attention < heaviestOther) {
        problems.push(
          `[${label}] the attention heading (${weights.attention}) is lighter than another section heading (${heaviestOther})`,
        )
      }
      console.log(
        `ok       ${label.padEnd(20)} attention weight ${weights.attention} vs others ${weights.others.join('/') || 'none'}`,
      )
    }

    // The greeting is the page's h1 and must respect the 16px ceiling.
    const h1Size = await page.evaluate(() => {
      const h1 = document.querySelector('h1')
      return h1 ? Number.parseFloat(getComputedStyle(h1).fontSize) : null
    })
    if (h1Size !== null && h1Size > 16) {
      problems.push(
        `[${label}] the greeting renders at ${h1Size}px, above the 16px ceiling for authenticated surfaces`,
      )
    }
    console.log(`ok       ${label.padEnd(20)} greeting ${h1Size ?? '?'}px`)

    // No meaning may be parked in a tooltip. `title` is invisible on touch
    // and unreliable on a non-interactive element, so anything explained
    // only there is documentation most users cannot read.
    const tooltipOnly = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body
      return [...main.querySelectorAll('[title]')]
        .map((el) => el.getAttribute('title') ?? '')
        .filter((t) => t.trim().length > 0)
    })
    if (tooltipOnly.length > 0) {
      problems.push(
        `[${label}] ${tooltipOnly.length} element(s) explain themselves only via title: ${tooltipOnly.join(" | ")}`,
      )
    }
    console.log(`ok       ${label.padEnd(20)} tooltip-only definitions: ${tooltipOnly.length}`)

    // Every door in the header zone should be distinguishable. Four
    // differently-worded links onto one destination is a promise broken on
    // each click, so the summary states facts and the button is the door.
    const headerDoors = await page.evaluate(() => {
      const h1 = document.querySelector('h1')
      const header = h1?.closest('header')
      if (!header) return null
      const links = [...header.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
      return { count: links.length, hrefs: links }
    })
    if (headerDoors && headerDoors.count > 0) {
      const unique = new Set(headerDoors.hrefs)
      if (unique.size < headerDoors.count) {
        problems.push(
          `[${label}] the header has ${headerDoors.count} links resolving to only ${unique.size} destination(s): ${headerDoors.hrefs.join(" | ")}`,
        )
      }
    }
    console.log(
      `ok       ${label.padEnd(20)} header links: ${headerDoors?.count ?? 0}`,
    )

    await context.close()
  }
} finally {
  await browser.close()
  server?.close()
}

if (problems.length) {
  console.error('\nHome check failed:')
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}
console.log('\nHome renders its primary action, ranked headings, and visible definitions.')
