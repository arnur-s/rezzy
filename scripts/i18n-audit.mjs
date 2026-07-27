#!/usr/bin/env node
/**
 * Audits the Paraglide message catalogues.
 *
 * Fails on the defects that ship broken text to a user: a key one locale
 * defines and the other does not, a key `src` calls that nobody defines, and a
 * translation whose `{placeholders}` do not match its source. Reports, without
 * failing, on keys nobody references and on strings that are byte-identical
 * across locales — both are usually stale rather than wrong.
 *
 * Usage: node scripts/i18n-audit.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const messagesDir = path.join(root, 'messages')
const srcDir = path.join(root, 'src')

const load = (locale) =>
  JSON.parse(readFileSync(path.join(messagesDir, `${locale}.json`), 'utf8'))

const en = load('en')
const ru = load('ru')
const isKey = (key) => key !== '$schema'
const enKeys = Object.keys(en).filter(isKey)
const ruKeys = Object.keys(ru).filter(isKey)

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      // Generated output; it defines every key by construction.
      return entry === 'paraglide' ? [] : walk(full)
    }
    return /\.(ts|tsx)$/.test(full) ? [full] : []
  })

const sources = walk(srcDir).filter((file) => !file.endsWith('routeTree.gen.ts'))
const used = new Map()
for (const file of sources) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/\bm\.([A-Za-z0-9_$]+)\s*\(/g)) {
    const key = match[1]
    if (!used.has(key)) used.set(key, new Set())
    used.get(key).add(path.relative(root, file))
  }
}

/** Complex (variant) messages are arrays; flatten their arms to compare text. */
const textOf = (value) =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value.flatMap((entry) => Object.values(entry.match ?? {}))
      : []

const placeholdersOf = (value) =>
  [
    ...new Set(
      textOf(value).flatMap((text) =>
        [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]),
      ),
    ),
  ]
    .sort()
    .join(',')

const missingInRu = enKeys.filter((key) => !(key in ru))
const missingInEn = ruKeys.filter((key) => !(key in en))
const undefinedKeys = [...used.keys()].filter(
  (key) => !(key in en) && !(key in ru),
)
const unusedKeys = enKeys.filter((key) => !used.has(key))
const identical = enKeys.filter(
  (key) =>
    key in ru &&
    JSON.stringify(en[key]) === JSON.stringify(ru[key]) &&
    textOf(en[key]).some((text) => /[A-Za-z]/.test(text)),
)
const placeholderMismatch = enKeys
  .filter((key) => key in ru && placeholdersOf(en[key]) !== placeholdersOf(ru[key]))
  .map(
    (key) =>
      `${key}: en(${placeholdersOf(en[key])}) ru(${placeholdersOf(ru[key])})`,
  )

const report = (title, items, isFailure = false) => {
  const mark = isFailure && items.length > 0 ? 'FAIL' : 'ok  '
  console.log(`\n${mark} ${title} (${items.length})`)
  for (const item of items) console.log(`       ${item}`)
}

console.log(`en keys: ${enKeys.length}  ru keys: ${ruKeys.length}`)
report('Missing in ru.json', missingInRu, true)
report('Missing in en.json', missingInEn, true)
report('Referenced in src but not defined', undefinedKeys, true)
report('Placeholder mismatch between locales', placeholderMismatch, true)
report('Defined but never referenced', unusedKeys)
report('Identical in both locales (may be untranslated)', identical)

const failures =
  missingInRu.length +
  missingInEn.length +
  undefinedKeys.length +
  placeholderMismatch.length

if (failures > 0) {
  console.error(`\n${failures} blocking i18n problems.`)
  process.exit(1)
}
console.log('\nCatalogues are consistent.')
