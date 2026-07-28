/**
 * Fails when any rendered text is smaller than the readable floor.
 *
 * The type scale is base 16 / ratio 1.25, which generates 10.24px at `xs` and
 * keeps going down (8.19 / 6.55 / 5.24) at `2xs`, `3xs`, and `4xs`. Those are
 * theme tokens, so a size below the floor is one `text-xs` away at any time, and
 * the token is not the only source: Astryx ships at least one component with a
 * literal `font-size:10px` in its stylesheet, which no change to the scale can
 * reach.
 *
 * So the assertion is made against the DOM rather than against the tokens. This
 * walks every element that renders text on every route, in both locales and both
 * color modes, reads the computed size, and reports anything under the floor
 * with the text it was drawn with — which is also the only way to catch a
 * hardcoded size inside a dependency.
 *
 * Usage: pnpm build && pnpm check:font-size
 */
import { WORKSPACE_ID, installFakeAuth } from './fake-auth.mjs'
import { hasBuild, serveDist } from './serve-dist.mjs'
import { chromium } from 'playwright'
import process from 'node:process'

const PORT = 4178
const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`
const OWNS_SERVER = !process.env.BASE_URL

/**
 * The floor, in px.
 *
 * 12px is the bottom of the legible range for interface text: iOS Safari
 * force-zooms focused inputs below 16px, Android's accessibility guidance puts
 * 12sp at the low end, and the default locale here is Russian, whose diacritics
 * and soft signs are the first thing to disappear as size drops.
 */
const FLOOR = 12

/** Sub-pixel slack, so a 11.9999px computed value from rem math is not a failure. */
const EPSILON = 0.01

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

/** Desktop and phone: a size can differ by breakpoint. */
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]

if (OWNS_SERVER && !hasBuild()) {
  console.error('No dist/ build found. Run `pnpm build` first.')
  process.exit(1)
}

/**
 * Every element rendering a non-empty text node, with its computed size.
 *
 * Only elements holding their own text count. Reading every element would
 * report a container whose inherited size is small but which draws no glyphs,
 * and would report the same string once per ancestor.
 *
 * Runs in the page, so it takes its thresholds as arguments rather than closing
 * over the module scope.
 */
function findSmallText([floorPx, epsilonPx]) {
  const problems = []
  const seen = new Set()

  for (const el of document.querySelectorAll('*')) {
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim()
    if (!ownText) continue

    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    if (Number(style.opacity) === 0) continue
    const size = parseFloat(style.fontSize)
    if (!Number.isFinite(size) || size >= floorPx - epsilonPx) continue

    // A zero-box node (screen-reader-only text) is not rendered text.
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue

    const className = typeof el.className === 'string' ? el.className : ''
    const key = `${el.tagName}|${className}|${size}|${ownText.slice(0, 40)}`
    if (seen.has(key)) continue
    seen.add(key)

    problems.push({
      tag: el.tagName.toLowerCase(),
      className,
      size: Math.round(size * 100) / 100,
      text: ownText.slice(0, 60),
    })
  }
  return problems
}

const server = OWNS_SERVER ? await serveDist(PORT) : null
const browser = await chromium.launch()
const problems = []
let checked = 0

try {
  for (const locale of ['ru', 'en']) {
    for (const mode of ['light', 'dark']) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          locale,
          colorScheme: mode,
        })
        const page = await context.newPage()
        await installFakeAuth(page, BASE, { language: locale })
        await context.addCookies([
          { name: 'PARAGLIDE_LOCALE', value: locale, url: BASE },
        ])

        for (const [name, route] of ROUTES) {
          await page.goto(BASE + route, { waitUntil: 'networkidle' })
          await page.waitForTimeout(300)
          const found = await page.evaluate(findSmallText, [FLOOR, EPSILON])
          checked += 1
          for (const p of found) {
            problems.push(
              `[${locale}/${mode}/${viewport.name}] ${name}: ` +
                `${p.size}px on <${p.tag}> "${p.text}"` +
                (p.className ? `\n        class: ${p.className}` : ''),
            )
          }
        }

        await context.close()
      }
    }
  }
} finally {
  await browser.close()
  server?.close()
}

if (problems.length) {
  console.error(`Text rendered below the ${FLOOR}px floor:\n`)
  // Same class at the same size on many routes is one defect, not many.
  const unique = [...new Set(problems)]
  for (const p of unique.slice(0, 40)) console.error(`  ${p}`)
  if (unique.length > 40) console.error(`  … ${unique.length - 40} more`)
  console.error(
    `\n${unique.length} occurrence(s). Raise the size at the source: a theme\n` +
      `token in src/themes/gothic/gothicTheme.ts (then \`pnpm theme:build\`),\n` +
      `or an override in src/styles.css when the size is inside a dependency.`,
  )
  process.exit(1)
}

console.log(
  `No text below ${FLOOR}px across ${checked} route renders ` +
    `(${ROUTES.length} routes x 2 locales x 2 modes x ${VIEWPORTS.length} widths).`,
)
