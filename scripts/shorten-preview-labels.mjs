#!/usr/bin/env node
/**
 * Shortens the "message preview" option labels.
 *
 * The setting row already reads "Message preview" / "Предпросмотр сообщения",
 * so the option repeated the noun back: "Show full message" and, in Russian,
 * "Показывать сообщение полностью" — long enough that the select truncated it
 * to "Показывать сообще…". The three options read better as a parallel set of
 * short nouns under a label that has already said what they describe.
 *
 * Usage: node scripts/shorten-preview-labels.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** path -> [expected, replacement] */
const REPLACEMENTS = {
  'messages/en.json': ['Show full message', 'Full message'],
  'messages/ru.json': ['Показывать сообщение полностью', 'Полностью'],
}

const KEY = 'settings_notifications_preview_full_label'

for (const [path, [expected, replacement]] of Object.entries(REPLACEMENTS)) {
  const messages = JSON.parse(readFileSync(path, 'utf8'))
  if (messages[KEY] !== expected) {
    throw new Error(
      `${path}: ${KEY} is ${JSON.stringify(messages[KEY])}, expected ${JSON.stringify(expected)}`,
    )
  }
  messages[KEY] = replacement
  writeFileSync(path, `${JSON.stringify(messages, null, 2)}\n`)
  console.log(`${path}: ${KEY} -> ${JSON.stringify(replacement)}`)
}
