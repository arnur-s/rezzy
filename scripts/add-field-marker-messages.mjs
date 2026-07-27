#!/usr/bin/env node
/**
 * Adds the field required/optional markers.
 *
 * Astryx's `isRequired` / `isOptional` render the literal English words
 * "Required" and "Optional" beside the label. That string is hardcoded in the
 * design system's `FieldLabel` rather than routed through its own translator,
 * and Astryx ships no Russian catalogue, so a Russian page printed
 * "Полное имя · Required". These keys let the app write the marker itself.
 *
 * Usage: node scripts/add-field-marker-messages.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** key -> [en, ru] */
const NEW_MESSAGES = {
  field_required: ['Required', 'Обязательно'],
  field_optional: ['Optional', 'Необязательно'],
}

function apply(path, index) {
  const messages = JSON.parse(readFileSync(path, 'utf8'))
  let added = 0
  for (const [key, values] of Object.entries(NEW_MESSAGES)) {
    if (key in messages) continue
    messages[key] = values[index]
    added += 1
  }
  writeFileSync(path, `${JSON.stringify(messages, null, 2)}\n`)
  console.log(`${path}: added ${added} messages`)
}

apply('messages/en.json', 0)
apply('messages/ru.json', 1)
