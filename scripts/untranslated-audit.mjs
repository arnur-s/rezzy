#!/usr/bin/env node
/**
 * Flags user-facing English that bypasses Paraglide.
 *
 * `baseLocale` is `ru`, so a hardcoded English literal is not a cosmetic
 * inconsistency — it is a Russian screen with an English sentence on it. This
 * catches the three places they hid: string literals passed to label-shaped
 * props, Zod validation messages, and bare JSX text nodes.
 *
 * Usage: node scripts/untranslated-audit.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'src')

// `test` holds fixtures, `paraglide` is generated, and `icons`/`fonts` carry no
// prose.
const SKIP_DIRS = new Set(['paraglide', 'test', 'fonts', 'icons'])

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      return SKIP_DIRS.has(entry) ? [] : walk(full)
    }
    return /\.(ts|tsx)$/.test(full) && !/\.(test|spec)\.tsx?$/.test(full)
      ? [full]
      : []
  })

/**
 * Sentence-shaped: a capitalized word followed by at least one more lowercase
 * word. Deliberately narrow, so component names, CSS classes, design tokens,
 * and single-word enum values do not trip it.
 */
const SENTENCE = /^[A-Z][a-z']+(?:[ ,][a-z'’]+){1,}/

const PROP_LITERAL =
  /\b(label|placeholder|title|description|message|body|helperText|alt|aria-label|emptyMessage|confirmLabel|cancelLabel)\s*=\s*(?:\{\s*)?['"]([^'"]{4,})['"]/g
const ZOD_MESSAGE =
  /\.(min|max|length|email|url|regex|refine|enum|nonempty)\([^)]*?['"]([^'"]{6,})['"]/g
const JSX_TEXT = />\s*([A-Z][a-z][^<>{}\n]{6,})\s*</g

const findings = []
for (const file of walk(srcDir)) {
  const text = readFileSync(file, 'utf8')
  const rel = path.relative(root, file).replace(/\\/g, '/')
  const lineOf = (index) => text.slice(0, index).split('\n').length

  const record = (kind, value, index) => {
    if (!SENTENCE.test(value)) return
    findings.push({ rel, line: lineOf(index), kind, value })
  }

  for (const match of text.matchAll(PROP_LITERAL)) {
    record('prop', match[2], match.index)
  }
  for (const match of text.matchAll(ZOD_MESSAGE)) {
    record('zod', match[2], match.index)
  }
  for (const match of text.matchAll(JSX_TEXT)) {
    record('jsx', match[1].trim(), match.index)
  }
}

if (findings.length === 0) {
  console.log('No untranslated user-facing literals found.')
} else {
  console.error(`Untranslated user-facing literals (${findings.length}):\n`)
  for (const { rel, line, kind, value } of findings) {
    console.error(`  ${rel}:${line} [${kind}] ${value}`)
  }
  process.exit(1)
}
