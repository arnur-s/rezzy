/**
 * Fails on color utilities that name a token the theme does not define.
 *
 * Tailwind v4 generates color utilities from `--color-*` custom properties, so
 * `bg-success-soft` is only a class if `--color-success-soft` exists. When it
 * does not, nothing is emitted: no build error, no console warning, no missing
 * -class error at runtime. The element just renders with no background, and the
 * page looks intentional. Two of these shipped — the "all clear" check plates on
 * the dashboard were transparent circles for as long as the class existed.
 *
 * Type checking cannot see this (class names are strings), the linter has no
 * theme to compare against, and a screenshot only catches it if someone knows
 * what the missing plate was supposed to look like. So the check is: collect the
 * color tokens the theme actually defines, collect the color utilities `src`
 * actually writes, and report anything in the second set that is not in the
 * first.
 *
 * Usage: node scripts/token-usage-check.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const THEME_CSS = 'src/themes/gothic/theme.css'
const BRIDGE_CSS = 'node_modules/@astryxdesign/core/src/tailwind-theme.css'
const SRC_DIR = 'src'

/** Utility prefixes that resolve against the Tailwind color namespace. */
const COLOR_PREFIXES = [
  'bg',
  'text',
  'border',
  'ring',
  'fill',
  'stroke',
  'divide',
  'outline',
  'shadow',
  'accent',
  'caret',
  'decoration',
  'from',
  'via',
  'to',
]

/**
 * Names that are not theme colors but are valid in a color-prefixed utility:
 * Tailwind keywords and the non-color utilities that share a prefix
 * (`text-sm`, `border-2`, `shadow-xs`, `ring-inset`, `border-t-0`, …).
 *
 * Tailwind's own palette is handled separately, since those names carry a
 * numeric shade (`sky-500`) and must not be confused with a theme token.
 */
const NON_TOKEN = new Set([
  // keywords
  'inherit', 'current', 'transparent', 'black', 'white', 'none', 'auto',
  // type scale + text utilities
  'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl',
  '8xl', '9xl', 'left', 'center', 'right', 'justify', 'start', 'end', 'wrap',
  'nowrap', 'balance', 'pretty', 'ellipsis', 'clip', 'top', 'bottom', 'middle',
  'like', 'inherit',
  // border / ring / shadow / outline utilities
  'solid', 'dashed', 'dotted', 'double', 'hidden', 'collapse', 'separate',
  'inset', 'offset', 'x', 'y', 't', 'r', 'b', 'l', 's', 'e',
  // background utilities
  'cover', 'contain', 'repeat', 'fixed', 'local', 'scroll', 'origin',
  'image', 'linear', 'radial', 'conic',
])

/** Tailwind's built-in palette roots, only valid with a numeric shade. */
const TAILWIND_PALETTE = new Set([
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber',
  'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
])

/** Non-color namespaces whose utilities share a prefix with a color one. */
const OTHER_NAMESPACES = ['--shadow-', '--radius-', '--font-size-', '--text-']

/** Reads every custom property the theme and the Tailwind bridge define. */
function definedTokens() {
  const colors = new Set()
  const others = new Set()
  for (const file of [THEME_CSS, BRIDGE_CSS]) {
    let css
    try {
      css = readFileSync(file, 'utf8')
    } catch {
      console.error(`Cannot read ${file}`)
      process.exit(1)
    }
    for (const m of css.matchAll(/--color-([a-z0-9-]+)\s*:/g)) colors.add(m[1])
    for (const ns of OTHER_NAMESPACES) {
      const re = new RegExp(`${ns}([a-z0-9-]+)\\s*:`, 'g')
      for (const m of css.matchAll(re)) others.add(m[1])
    }
  }
  return { colors, others }
}

/** Every color-prefixed utility written in `src`, with the file that writes it. */
function usedColorUtilities() {
  const used = new Map()

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.tsx?$/.test(entry)) continue
      const code = readFileSync(full, 'utf8')
      const lines = code.split('\n')

      lines.forEach((line, i) => {
        for (const prefix of COLOR_PREFIXES) {
          // `bg-success/12`, `text-primary`, `hover:bg-error/10`, `dark:text-x`
          const re = new RegExp(
            `(?:^|[\\s"'\`:])${prefix}-([a-z][a-z0-9-]*)(?:/\\d+)?(?=[\\s"'\`\\]]|$)`,
            'g',
          )
          for (const m of line.matchAll(re)) {
            const name = m[1]
            if (NON_TOKEN.has(name)) continue
            // Arbitrary values (`text-[#26A5E4]`) never reach the token layer.
            if (name.startsWith('[')) continue
            // Tailwind's own palette, which always carries a numeric shade.
            if (/^[a-z]+-\d{2,3}$/.test(name)) {
              if (TAILWIND_PALETTE.has(name.split('-')[0])) continue
            }
            // Directional / numeric variants of a non-color utility:
            // `border-t-0`, `border-l-2`, `outline-offset-2`.
            if (/(^|-)(\d+)$/.test(name)) continue
            const key = `${prefix}-${name}`
            if (!used.has(key)) used.set(key, [])
            // The token name is what follows the prefix, but `border-*` reads
            // against `--color-border-*`, so both spellings are candidates.
            used.get(key).push({ site: `${full}:${i + 1}`, prefix, name })
          }
        }
      })
    }
  }
  walk(SRC_DIR)
  return used
}

const { colors, others } = definedTokens()
const used = usedColorUtilities()

const orphans = []
for (const [utility, entries] of used) {
  const { prefix, name } = entries[0]

  // A utility resolves if any namespace defines the name it points at.
  //
  // Both spellings have to be tried. Tailwind maps `bg-x` to `--color-x`, so
  // the bare name is the usual candidate — but several tokens are themselves
  // named for the property they style, and `border-strong` reads against
  // `--color-border-strong` rather than `--color-strong`. Checking only the
  // bare name reports every one of those as missing.
  const candidates = [name, `${prefix}-${name}`]
  if (candidates.some((c) => colors.has(c) || others.has(c))) continue

  orphans.push({ utility, sites: entries.map((e) => e.site) })
}

if (orphans.length) {
  console.error('Color utilities naming a token the theme does not define:\n')
  for (const { utility, sites } of orphans) {
    console.error(`  ${utility}`)
    for (const site of sites.slice(0, 5)) console.error(`      ${site}`)
    if (sites.length > 5) console.error(`      … ${sites.length - 5} more`)
  }
  console.error(
    '\nTailwind emits no rule for these, so they render as nothing at all.\n' +
      'Either add the token to src/themes/gothic/gothicTheme.ts and run\n' +
      '`pnpm theme:build`, or use a token that exists.',
  )
  process.exit(1)
}

console.log(
  `All ${used.size} color utilities in ${SRC_DIR} resolve to a defined token.`,
)
