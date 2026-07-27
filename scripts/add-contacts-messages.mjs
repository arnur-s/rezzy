#!/usr/bin/env node
/**
 * Adds copy for the contacts route, which shipped as router scaffolding
 * rendering the literal `Hello "/_authenticated/workspaces/$id/contacts"!`.
 *
 * Usage: node scripts/add-contacts-messages.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** key -> [en, ru] */
const NEW_MESSAGES = {
  contacts_empty_title: ['No contact directory yet', 'Списка контактов пока нет'],
  contacts_empty_description: [
    'Contact details, notes, and history live beside each conversation in the inbox.',
    'Данные, заметки и история — рядом с каждым диалогом во входящих.',
  ],
  contacts_empty_open_inbox: ['Open inbox', 'Открыть входящие'],
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
