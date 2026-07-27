#!/usr/bin/env node
/**
 * Adds the message keys that hardcoded English strings in `src` are being
 * replaced by, so the catalogue and the code change in one reviewable pair.
 *
 * The strings these cover were Zod validation messages and API fallbacks
 * written as English literals. Russian is `baseLocale`, so a Russian-speaking
 * user filling in the Telegram or workspace form saw the whole interface in
 * Russian and its error messages in English.
 *
 * Usage: node scripts/add-validation-messages.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** key -> [en, ru] */
const NEW_MESSAGES = {
  // Shared across every channel form and the workspace form.
  validation_name_min: [
    'Use at least 2 characters',
    'Минимум 2 символа',
  ],
  validation_name_optional_min: [
    'Use at least 2 characters, or leave it empty',
    'Минимум 2 символа — или оставьте поле пустым',
  ],
  validation_name_max: [
    'Use 80 characters or fewer',
    'Не больше 80 символов',
  ],
  validation_description_max: [
    'Use 240 characters or fewer',
    'Не больше 240 символов',
  ],
  validation_required: ['Fill this in', 'Заполните это поле'],
  validation_digits_only: ['Digits only', 'Только цифры'],

  workspaces_icon_required: ['Pick an icon', 'Выберите иконку'],

  channels_telegram_token_invalid: [
    'A bot token looks like 123456789:AA... — copy the whole line from @BotFather',
    'Токен выглядит так: 123456789:AA… — скопируйте строку из @BotFather целиком',
  ],

  auth_sign_up_full_name_required: [
    'Enter your name',
    'Укажите ваше имя',
  ],

  // Contacts arriving from a channel without a display name. Was the English
  // literal 'Untitled contact' baked into the dashboard API layer.
  contact_unnamed: ['Unnamed contact', 'Без имени'],
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
