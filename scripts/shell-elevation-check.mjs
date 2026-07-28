/**
 * Checks that the shell's elevated panes are actually visible.
 *
 * The frame is arithmetic, not styling: a pane reads as a pane only because
 * `--color-background-surface` sits above `--color-background-body` and because
 * there is real gutter between them for the shadow to fall into. Both are
 * theme-level values, so a theme swap can collapse either one without touching
 * a line of component code — and the result still renders, still passes
 * typecheck, still passes the unit suite. The app just quietly becomes one flat
 * sheet with unexplained gaps in it, which is exactly the state this redesign
 * replaced.
 *
 * jsdom cannot see any of this: it has no layout and no computed fills. So the
 * assertions run against the built bundle in a real browser, in both colour
 * modes, on the routes where the frame is fully expressed.
 *
 * What is asserted, per mode:
 *
 *  1. Canvas and pane fills differ. This is the one that silently regresses.
 *  2. Every pane is inset — no pane touches the shell's content edge on a side
 *     where the gutter should be.
 *  3. Sibling panes are separated by canvas, not by contact. Two panes flush
 *     against each other read as one pane with a seam.
 *  4. At phone width the frame is gone: the pane is full-bleed, because a
 *     390px screen cannot afford to spend 16px of it on a decorative margin.
 *  5. The seam still resizes the conversation list, by drag and by keyboard,
 *     and the width survives a reload. The handle sits in the gutter rather
 *     than on a panel that manages its own width, so the wiring is app code
 *     that would render identically if it were disconnected.
 *
 * Usage: pnpm build && pnpm check:shell-elevation
 */
import { WORKSPACE_ID, installFakeAuth } from './fake-auth.mjs'
import { hasBuild, serveDist } from './serve-dist.mjs'
import { chromium } from 'playwright'
import process from 'node:process'

const PORT = 4181
const BASE = `http://127.0.0.1:${PORT}`

/** The gutter `AppPaneGroup` applies from `md` up (`p-2` / `gap-2`). */
const GUTTER_PX = 8

/** Tolerance for sub-pixel layout and fractional device ratios. */
const EPSILON = 1.5

const ROUTES = [
  ['inbox', `/workspaces/${WORKSPACE_ID}/inbox`, { minPanes: 2 }],
  ['home', '/', { minPanes: 1 }],
  ['workspace settings', `/workspaces/${WORKSPACE_ID}/settings`, { minPanes: 1 }],
]

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

if (!hasBuild()) {
  console.error('No dist/ build found. Run `pnpm build` first.')
  process.exit(1)
}

/**
 * Reads the frame out of the live page.
 *
 * Fills are read with `getComputedStyle` rather than from the CSS variables,
 * because what matters is the colour that actually paints — a variable can be
 * defined correctly and still be overridden downstream.
 */
const readFrame = () =>
  window.__readShellFrame()

const INSTRUMENT = () => {
  window.__readShellFrame = () => {
    const group = document.querySelector('[data-app-pane-group]')
    if (!group) return { error: 'no pane group in the DOM' }

    const panes = Array.from(group.querySelectorAll('[data-app-pane]'))
    if (panes.length === 0) return { error: 'pane group holds no panes' }

    const rect = (el) => {
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }

    return {
      canvas: getComputedStyle(group).backgroundColor,
      group: rect(group),
      panes: panes.map((pane) => ({
        fill: getComputedStyle(pane).backgroundColor,
        radius: getComputedStyle(pane).borderTopLeftRadius,
        shadow: getComputedStyle(pane).boxShadow,
        ...rect(pane),
      })),
    }
  }
}

/**
 * The canvas fill can be `rgba(0, 0, 0, 0)` when the group itself is
 * transparent and the tone comes from the shell behind it. That is fine and
 * expected — what must not happen is the canvas and the pane painting the same
 * visible colour. So resolve transparency against the element behind it.
 */
const effectiveCanvas = (page) =>
  page.evaluate(() => {
    let el = document.querySelector('[data-app-pane-group]')
    while (el) {
      const bg = getComputedStyle(el).backgroundColor
      const alpha = bg.startsWith('rgba') ? Number(bg.split(',')[3]) : 1
      if (alpha > 0) return bg
      el = el.parentElement
    }
    return getComputedStyle(document.body).backgroundColor
  })

const server = await serveDist(PORT)
const browser = await chromium.launch()
const problems = []

try {
  for (const mode of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: DESKTOP,
      colorScheme: mode,
      locale: 'ru',
    })
    await context.addCookies([
      { name: 'PARAGLIDE_LOCALE', value: 'ru', url: BASE },
    ])
    await context.addInitScript(INSTRUMENT)
    const page = await context.newPage()
    await installFakeAuth(page, BASE, { language: 'ru' })

    for (const [label, route, { minPanes }] of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' })
      await page.waitForTimeout(600)

      const frame = await page.evaluate(readFrame)
      if (frame.error) {
        problems.push(`[${mode}] ${label}: ${frame.error}`)
        continue
      }

      const canvas = await effectiveCanvas(page)
      const { panes, group } = frame

      if (panes.length < minPanes) {
        problems.push(
          `[${mode}] ${label}: expected at least ${minPanes} pane(s), ` +
            `found ${panes.length}`,
        )
      }

      // 1. Canvas and pane must not resolve to the same colour.
      for (const [index, pane] of panes.entries()) {
        if (pane.fill === canvas) {
          problems.push(
            `[${mode}] ${label}: pane ${index} paints ${pane.fill}, the same ` +
              `as the canvas — every pane is invisible and the shell reads as ` +
              `one flat sheet. A theme collapsed background-surface into ` +
              `background-body.`,
          )
        }
        if (pane.radius === '0px') {
          problems.push(
            `[${mode}] ${label}: pane ${index} has no corner radius at ` +
              `desktop width`,
          )
        }
        if (pane.shadow === 'none') {
          problems.push(
            `[${mode}] ${label}: pane ${index} casts no shadow — nothing ` +
              `lifts it off the canvas`,
          )
        }
      }

      // 2. Every pane is inset from the frame's outer edges.
      for (const [index, pane] of panes.entries()) {
        const insets = {
          top: pane.top - group.top,
          bottom: group.bottom - pane.bottom,
          left: pane.left - group.left,
          right: group.right - pane.right,
        }
        for (const [side, value] of Object.entries(insets)) {
          // Left/right insets only apply to the outermost panes; interior
          // panes are bounded by their siblings, covered by check 3.
          const isInterior =
            (side === 'left' && index > 0) ||
            (side === 'right' && index < panes.length - 1)
          if (isInterior) continue
          if (value < GUTTER_PX - EPSILON) {
            problems.push(
              `[${mode}] ${label}: pane ${index} sits ${value.toFixed(1)}px ` +
                `from the frame's ${side} edge, expected ${GUTTER_PX}px — the ` +
                `gutter is missing, so the pane is not inset`,
            )
          }
        }
      }

      // 3. Sibling panes are separated by canvas rather than touching.
      for (let i = 1; i < panes.length; i += 1) {
        const gap = panes[i].left - panes[i - 1].right
        if (gap < GUTTER_PX - EPSILON) {
          problems.push(
            `[${mode}] ${label}: panes ${i - 1} and ${i} are ` +
              `${gap.toFixed(1)}px apart, expected ${GUTTER_PX}px — with no ` +
              `canvas between them they read as one pane with a seam`,
          )
        }
      }

      console.log(
        `${mode} ${label}: ${panes.length} pane(s), canvas ${canvas}, ` +
          `pane ${panes[0].fill}`,
      )
    }

    await context.close()
  }

  // 4. Phone width drops the frame entirely.
  const phone = await browser.newContext({
    viewport: PHONE,
    colorScheme: 'light',
    locale: 'ru',
  })
  await phone.addCookies([
    { name: 'PARAGLIDE_LOCALE', value: 'ru', url: BASE },
  ])
  await phone.addInitScript(INSTRUMENT)
  const phonePage = await phone.newPage()
  await installFakeAuth(phonePage, BASE, { language: 'ru' })

  for (const [label, route] of ROUTES) {
    await phonePage.goto(BASE + route, { waitUntil: 'networkidle' })
    await phonePage.waitForTimeout(600)

    const frame = await phonePage.evaluate(readFrame)
    if (frame.error) {
      problems.push(`[phone] ${label}: ${frame.error}`)
      continue
    }

    for (const [index, pane] of frame.panes.entries()) {
      const inset = Math.max(
        pane.left - frame.group.left,
        frame.group.right - pane.right,
      )
      if (inset > EPSILON) {
        problems.push(
          `[phone] ${label}: pane ${index} is inset ${inset.toFixed(1)}px at ` +
            `${PHONE.width}px wide — the gutter should be dropped below md so ` +
            `the pane goes full-bleed`,
        )
      }
      if (pane.radius !== '0px') {
        problems.push(
          `[phone] ${label}: pane ${index} keeps a ${pane.radius} radius at ` +
            `phone width, so its corners curve away from the screen edge`,
        )
      }
    }

    console.log(`phone ${label}: ${frame.panes.length} pane(s), full-bleed`)
  }

  await phone.close()

  // 5. The seam is still draggable.
  //
  // The handle used to live inside `LayoutPanel`, which applied the width
  // itself. It now sits between plain panes and the width is passed to the
  // list pane explicitly, so the wiring runs through app code that renders
  // perfectly whether or not it is connected. Drag it and watch the pane.
  const resize = await browser.newContext({
    viewport: DESKTOP,
    colorScheme: 'light',
    locale: 'ru',
  })
  await resize.addCookies([
    { name: 'PARAGLIDE_LOCALE', value: 'ru', url: BASE },
  ])
  const resizePage = await resize.newPage()
  await installFakeAuth(resizePage, BASE, { language: 'ru' })
  await resizePage.goto(`${BASE}/workspaces/${WORKSPACE_ID}/inbox`, {
    waitUntil: 'networkidle',
  })
  await resizePage.waitForTimeout(600)

  const listWidth = () =>
    resizePage.evaluate(
      () =>
        document.querySelector('[data-app-pane]')?.getBoundingClientRect()
          .width ?? 0,
    )

  const DRAG_PX = 80
  const before = await listWidth()
  const handle = resizePage.getByRole('separator').first()
  const box = await handle.boundingBox()

  if (!box) {
    problems.push('the resize handle has no box, so the seam cannot be grabbed')
  } else {
    await resizePage.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await resizePage.mouse.down()
    await resizePage.mouse.move(
      box.x + box.width / 2 + DRAG_PX,
      box.y + box.height / 2,
      { steps: 12 },
    )
    await resizePage.mouse.up()
    await resizePage.waitForTimeout(400)
  }

  const afterDrag = await listWidth()
  const moved = afterDrag - before
  if (Math.abs(moved - DRAG_PX) > 12) {
    problems.push(
      `dragging the seam ${DRAG_PX}px moved the list pane ${moved.toFixed(1)}px ` +
        `— the handle is no longer wired to the pane width`,
    )
  }

  // The width is persisted under `inbox:list-width`, so a reload must keep it.
  await resizePage.reload({ waitUntil: 'networkidle' })
  await resizePage.waitForTimeout(600)
  const afterReload = await listWidth()
  if (Math.abs(afterReload - afterDrag) > 2) {
    problems.push(
      `the resized width did not survive a reload: ${afterDrag.toFixed(1)}px ` +
        `became ${afterReload.toFixed(1)}px`,
    )
  }

  // Keyboard resizing is the accessible path through the same props.
  await resizePage.getByRole('separator').first().focus()
  const beforeKeys = await listWidth()
  await resizePage.keyboard.press('ArrowRight')
  await resizePage.waitForTimeout(200)
  const afterKeys = await listWidth()
  if (afterKeys <= beforeKeys) {
    problems.push(
      `ArrowRight on the focused handle did not widen the pane ` +
        `(${beforeKeys.toFixed(1)}px -> ${afterKeys.toFixed(1)}px)`,
    )
  }

  console.log(
    `resize: ${before.toFixed(0)}px -> ${afterDrag.toFixed(0)}px dragged, ` +
      `${afterReload.toFixed(0)}px after reload, ` +
      `${afterKeys.toFixed(0)}px after ArrowRight`,
  )

  await resize.close()
} finally {
  await browser.close()
  server.close()
}

if (problems.length) {
  console.error('\nShell elevation check failed:')
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log(
  '\nPanes are elevated, inset, separated by canvas, and the seam resizes.',
)
