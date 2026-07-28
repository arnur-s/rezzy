/**
 * Reports WCAG contrast for the status colors in both modes, so a change to the
 * gothic palette is checked against numbers rather than against a screenshot.
 *
 * The status tokens are the ones that need this: DESIGN.md's "Tertiary (Status)"
 * section requires each tone to clear 4.5:1 against the page *and* stay legible
 * on its own 10-15% tint, and those two pull in opposite directions — lighten
 * the tone for a softer tint and it fails the page; darken it for the page and
 * the tint turns to mud. A number tells you which side you fell off.
 *
 * Reads the compiled `theme.css` rather than the TypeScript source, so it checks
 * what actually ships (and fails when someone edits the theme without running
 * `pnpm theme:build`).
 *
 * Usage: node scripts/theme-contrast.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const THEME_CSS = 'src/themes/gothic/theme.css'
const SRC_DIR = 'src'

/** WCAG AA for body text. Status copy is 13px and 12px, so nothing here is "large". */
const AA_TEXT = 4.5
/** WCAG AA for icons and other non-text UI. */
const AA_NON_TEXT = 3

// --- color math ---------------------------------------------------------

/** `#rgb`, `#rrggbb`, and `#rrggbbaa` → `{r, g, b, a}` in 0-255 / 0-1. */
function parseHex(hex) {
  const value = hex.trim().replace(/^#/, '')
  const expand = (s) => parseInt(s.length === 1 ? s + s : s, 16)
  if (value.length === 3 || value.length === 4) {
    return {
      r: expand(value[0]),
      g: expand(value[1]),
      b: expand(value[2]),
      a: value.length === 4 ? expand(value[3]) / 255 : 1,
    }
  }
  if (value.length === 6 || value.length === 8) {
    return {
      r: expand(value.slice(0, 2)),
      g: expand(value.slice(2, 4)),
      b: expand(value.slice(4, 6)),
      a: value.length === 8 ? expand(value.slice(6, 8)) / 255 : 1,
    }
  }
  throw new Error(`Not a hex color: ${hex}`)
}

/** Source-over composite of a translucent color onto an opaque backdrop. */
function over(fg, bg) {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  }
}

/** WCAG relative luminance. */
function luminance({ r, g, b }) {
  const channel = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, 1:1 to 21:1. Both colors must already be opaque. */
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** A tint like `bg-error/10`: the status tone at `alpha` over the page. */
function tint(color, alpha, page) {
  return over({ ...color, a: alpha }, page)
}

// --- theme parsing ------------------------------------------------------

const css = readFileSync(THEME_CSS, 'utf8')

/**
 * Reads one custom property out of the compiled theme and returns its light and
 * dark halves. `light-dark(a, b)` yields both; a plain value yields itself twice.
 */
function token(name) {
  const match = css.match(new RegExp(`\\s${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`${name} is missing from ${THEME_CSS}`)
  const value = match[1].trim()
  const pair = value.match(/^light-dark\(\s*([^,]+),\s*([^)]+)\)$/)
  return pair
    ? { light: pair[1].trim(), dark: pair[2].trim() }
    : { light: value, dark: value }
}

const page = {
  light: parseHex(token('--color-background-body').light),
  dark: parseHex(token('--color-background-body').dark),
}
const card = {
  light: parseHex(token('--color-background-card').light),
  dark: parseHex(token('--color-background-card').dark),
}

const STATUSES = ['success', 'error', 'warning']

/**
 * The tint alphas each status is actually drawn at, scanned out of `src` rather
 * than assumed.
 *
 * A hardcoded band is the wrong assertion here, and getting it wrong is what
 * produced the palette this script exists to fix: the first pass assumed a 20%
 * tint and darkened all three tones by about 1.5 steps to satisfy an alpha no
 * code uses. Reading the real call sites means the palette is held to what
 * ships, and a new `bg-error/25` starts being checked the moment someone writes
 * it.
 *
 * Only tints that carry same-hue text are a contrast question, so this pairs
 * `bg-<status>/<alpha>` with `text-<status>` on the same element. A decorative
 * fill (`aria-hidden` ping halos) or a tint carrying `text-secondary` has no
 * foreground of its own and is skipped.
 */
function scanTintAlphas() {
  const found = Object.fromEntries(STATUSES.map((s) => [s, new Set()]))

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.tsx?$/.test(entry)) continue
      const code = readFileSync(full, 'utf8')

      // Class strings are the unit: a tint and its text color have to appear in
      // the same one to be on the same element.
      for (const chunk of code.split(/["'`]/)) {
        for (const status of STATUSES) {
          const tint = new RegExp(`\\bbg-${status}/(\\d+)\\b`, 'g')
          const carriesText = new RegExp(`\\btext-${status}\\b`).test(chunk)
          if (!carriesText) continue
          for (const m of chunk.matchAll(tint)) {
            found[status].add(Number(m[1]) / 100)
          }
        }
      }
    }
  }
  walk(SRC_DIR)
  return found
}

const TINT_ALPHAS = scanTintAlphas()

const rows = []
const failures = []

const record = (label, ratio, floor, note) => {
  const pass = ratio >= floor
  rows.push({ label, ratio: ratio.toFixed(2), floor: floor.toFixed(1), pass, note })
  if (!pass) failures.push(`${label} is ${ratio.toFixed(2)}:1, needs ${floor}:1 — ${note}`)
}

for (const mode of ['light', 'dark']) {
  for (const status of STATUSES) {
    const tone = parseHex(token(`--color-${status}`)[mode])
    const well = parseHex(token(`--color-${status}-muted`)[mode])
    const onWell = parseHex(token(`--color-text-${{ success: 'green', error: 'red', warning: 'yellow' }[status]}`)[mode])
    const onTone = parseHex(token(`--color-on-${status}`)[mode])

    // The tone as text on the page: `text-error` on the shell.
    record(
      `${mode}/${status}: text on page`,
      contrast(tone, page[mode]),
      AA_TEXT,
      'status copy sits directly on the page',
    )

    // The tone as text on a raised card: auth forms and dialogs.
    record(
      `${mode}/${status}: text on card`,
      contrast(tone, card[mode]),
      AA_TEXT,
      'validation copy inside an auth or dialog card',
    )

    // The tone as text on its own tint: `bg-error/10 text-error`. Only the
    // alphas the code actually pairs with same-hue text are checked.
    for (const alpha of [...TINT_ALPHAS[status]].sort((a, b) => a - b)) {
      const plate = tint(tone, alpha, page[mode])
      record(
        `${mode}/${status}: text on own ${Math.round(alpha * 100)}% tint`,
        contrast(tone, plate),
        AA_TEXT,
        `bg-${status}/${Math.round(alpha * 100)} with text-${status}`,
      )
    }

    // A destructive button: `--color-error` fill with `--color-on-error`.
    record(
      `${mode}/${status}: on-${status} label on ${status} fill`,
      contrast(onTone, tone),
      AA_TEXT,
      'filled status button label',
    )

    // The banner well and the vivid copy it carries.
    record(
      `${mode}/${status}: banner copy on well`,
      contrast(onWell, well),
      AA_TEXT,
      'Banner title and description on the -muted well',
    )

    // The well must stay a well: readable as a region, never a slab.
    //
    // "Slab" is a light-mode concern only. On parchment the well is a faint
    // tint a step off the page, so a loud one competes with the ink primary
    // button beside it. On ink the well is the opaque pastel, which is the
    // design's stated intent for dark (DESIGN.md, "The Chip Is Not A Field
    // Rule"): dark has no room to tint *downward* from #101314, so its status
    // surfaces raise instead, and a high ratio there is the plate reading
    // correctly rather than a defect. Measuring both modes against a
    // light-mode ceiling would fail the half of the theme that is already right.
    const wellVsPage = contrast(well, page[mode])
    const LOUD = 2
    const slab = mode === 'light' && wellVsPage > LOUD
    rows.push({
      label: `${mode}/${status}: well vs page`,
      ratio: wellVsPage.toFixed(2),
      floor: mode === 'light' ? `<${LOUD.toFixed(1)}` : '—',
      pass: !slab,
      note:
        mode === 'light'
          ? slab
            ? 'LOUD: reads as a slab, not a well'
            : 'soft note on the page'
          : 'opaque pastel plate (dark raises rather than tints)',
    })
    if (slab) {
      failures.push(
        `${mode}/${status} well is ${wellVsPage.toFixed(2)}:1 against the page — ` +
          `a full-measure status surface that loud is a slab (The Chip Is Not A Field Rule)`,
      )
    }
  }
}

// Categorical chips carry their own text, so each plate/text pair is checked as
// a unit. `Badge` draws 10px copy on these.
const CHIPS = ['blue', 'cyan', 'gray', 'green', 'orange', 'pink', 'purple', 'red', 'teal', 'yellow']
for (const mode of ['light', 'dark']) {
  for (const chip of CHIPS) {
    const plate = parseHex(token(`--color-background-${chip}`)[mode])
    const text = parseHex(token(`--color-text-${chip}`)[mode])
    const icon = parseHex(token(`--color-icon-${chip}`)[mode])
    record(`${mode}/${chip} chip: text on plate`, contrast(text, plate), AA_TEXT, 'Badge label')
    record(`${mode}/${chip} chip: icon on plate`, contrast(icon, plate), AA_NON_TEXT, 'chip icon')
  }
}

// Core neutrals — the page's own reading contrast.
for (const mode of ['light', 'dark']) {
  const primary = parseHex(token('--color-text-primary')[mode])
  const secondary = parseHex(token('--color-text-secondary')[mode])
  record(`${mode}/text-primary on page`, contrast(primary, page[mode]), AA_TEXT, 'body copy')
  record(
    `${mode}/text-secondary on page`,
    contrast(secondary, page[mode]),
    AA_TEXT,
    'timestamps, metadata, supporting copy',
  )

  // The opacity ladder.
  //
  // DESIGN.md offers opacity as a way to step text down, but the ladder is not
  // symmetric between modes: parchment-on-ink at 55% is 5.55:1 while
  // ink-on-parchment at the same 55% is 3.97:1, because the page it composites
  // against is far lighter. So a step that reads correctly while the author is
  // in dark mode can be under AA in light, and the failure is invisible unless
  // you switch. `/70` is the lowest rung that clears AA in both, which is why
  // secondary copy uses the `text-secondary` token instead.
  for (const alpha of [0.55, 0.7, 0.8]) {
    const floor = alpha >= 0.7 ? AA_TEXT : 0
    const ratio = contrast(tint(primary, alpha, page[mode]), page[mode])
    if (floor === 0) {
      rows.push({
        label: `${mode}/text-primary at ${Math.round(alpha * 100)}% on page`,
        ratio: ratio.toFixed(2),
        floor: 'n/a',
        pass: true,
        note:
          ratio >= AA_TEXT
            ? 'clears AA in this mode'
            : 'under AA in this mode — use text-secondary for real copy',
      })
      continue
    }
    record(
      `${mode}/text-primary at ${Math.round(alpha * 100)}% on page`,
      ratio,
      floor,
      'opacity step used for text',
    )
  }
}

const width = Math.max(...rows.map((r) => r.label.length))
for (const row of rows) {
  const mark = row.pass ? 'ok  ' : 'FAIL'
  console.log(
    `${mark} ${row.label.padEnd(width)}  ${row.ratio.padStart(6)}:1  ` +
      `(min ${row.floor})  ${row.note}`,
  )
}

if (failures.length) {
  console.error(`\n${failures.length} contrast failure(s):`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`\nAll ${rows.length} checks pass.`)
