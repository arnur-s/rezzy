#!/usr/bin/env node
/**
 * Copy for the inbox's empty thread pane.
 *
 * The pane said "Pick a conversation / Choose a conversation to read it and
 * reply" — the description restating the title, and both inviting a choice
 * that does not exist when the list beside them is empty. These give the
 * no-conversations case its own wording.
 *
 * Usage: node scripts/add-inbox-empty-messages.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** key -> [en, ru] */
const NEW_MESSAGES = {
  inbox_empty_no_conversations_title: [
    'No conversations yet',
    'Диалогов пока нет',
  ],
  inbox_empty_no_conversations_description: [
    'When a customer writes in on a connected channel, the conversation opens here.',
    'Когда клиент напишет в подключённый канал, диалог откроется здесь.',
  ],
}

/** Descriptions that were restating their own title. */
const REPLACEMENTS = {
  inbox_empty_select_conversation_description: [
    'Choose a conversation to read it and reply',
    'Its messages, the contact behind it, and your reply box open here.',
    'Здесь откроются сообщения, профиль клиента и поле для ответа.',
  ],
}

function apply(path, index) {
  const messages = JSON.parse(readFileSync(path, 'utf8'))
  let changed = 0

  for (const [key, values] of Object.entries(NEW_MESSAGES)) {
    if (key in messages) continue
    messages[key] = values[index]
    changed += 1
  }

  for (const [key, [expectedEn, ...values]] of Object.entries(REPLACEMENTS)) {
    if (index === 0 && messages[key] !== expectedEn) {
      throw new Error(
        `${path}: ${key} is ${JSON.stringify(messages[key])}, expected ${JSON.stringify(expectedEn)}`,
      )
    }
    messages[key] = values[index]
    changed += 1
  }

  writeFileSync(path, `${JSON.stringify(messages, null, 2)}\n`)
  console.log(`${path}: ${changed} messages`)
}

apply('messages/en.json', 0)
apply('messages/ru.json', 1)
