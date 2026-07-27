#!/usr/bin/env node
/**
 * Rewrites count-bearing messages as complex (variant) messages so each locale
 * picks the plural form its own grammar requires.
 *
 * Russian is `baseLocale` (project.inlang/settings.json), and Russian counts
 * take three forms — one / few / many. Every counted string in the catalogue
 * was a single fixed form, so the primary locale rendered "1 каналов",
 * "2 контактов" and "21 новых сообщений": the numbers were right and the nouns
 * never agreed with them. English has the same bug in miniature ("1 new
 * messages", "1 channels").
 *
 * This runs once and its output is committed. It stays in the repository as the
 * record of which keys are plural-sensitive and what each form should be, so a
 * later edit to one form does not silently drop the others.
 *
 * Usage: node scripts/pluralize-messages.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const EN_PATH = 'messages/en.json'
const RU_PATH = 'messages/ru.json'

const variant = (declarations, match) => [
  { declarations, selectors: ['countPlural'], match },
]

const COUNT_ONLY = ['input count', 'local countPlural = count: plural']
const COUNT_AND_TOTAL = [
  'input count',
  'input total',
  'local countPlural = count: plural',
]

/** English distinguishes one from everything else. */
const en2 = (one, other) =>
  variant(COUNT_ONLY, { 'countPlural=one': one, 'countPlural=*': other })

/**
 * Russian distinguishes 1, 2-4 and 5-20 (`one`, `few`, `many`). The `*` arm
 * catches the `other` category, which Intl.PluralRules returns for fractional
 * counts only; it takes the `few` form, as "1,5 канала" does.
 */
const ru3 = (one, few, many) =>
  variant(COUNT_ONLY, {
    'countPlural=one': one,
    'countPlural=few': few,
    'countPlural=many': many,
    'countPlural=*': few,
  })

const EN_PLURALS = {
  // "unread" is invariant in English, but the message still has to be a variant
  // so the Russian side can decline the noun it implies.
  home_summary_unread: en2('{count} unread', '{count} unread'),
  home_summary_open: en2(
    '{count} open assigned to you',
    '{count} open assigned to you',
  ),
  home_summary_waking: en2('{count} due back soon', '{count} due back soon'),
  home_summary_stale: en2('{count} going stale', '{count} going stale'),
  dashboard_workspace_card_open: en2('{count} open', '{count} open'),
  dashboard_workspace_card_channels: en2('{count} channel', '{count} channels'),
  dashboard_workspace_card_contacts: en2('{count} contact', '{count} contacts'),
  dashboard_workspace_card_unread_aria: en2(
    '{count} unread message',
    '{count} unread messages',
  ),
  inbox_unread_aria_label: en2('{count} unread message', '{count} unread messages'),
  notifications_unread_count_aria: en2(
    '{count} unread message',
    '{count} unread messages',
  ),
  sidebar_workspace_unread_dot_aria: en2(
    '{count} unread message',
    '{count} unread messages',
  ),
  home_attention_showing_top: variant(COUNT_AND_TOTAL, {
    'countPlural=one': 'Showing the most urgent of {total}',
    'countPlural=*': 'Showing the {count} most urgent of {total}',
  }),
  // Replaces the hand-rolled `_one` / `_many` / bare triplet the scroll button
  // used to branch on in TypeScript. Plural selection belongs to the locale,
  // not to a ternary in a component.
  inbox_new_messages_button: en2('{count} new message', '{count} new messages'),
}

const RU_PLURALS = {
  home_summary_unread: ru3(
    '{count} непрочитанный',
    '{count} непрочитанных',
    '{count} непрочитанных',
  ),
  home_summary_open: ru3(
    '{count} открытый на вас',
    '{count} открытых на вас',
    '{count} открытых на вас',
  ),
  home_summary_waking: ru3(
    '{count} скоро вернётся',
    '{count} скоро вернутся',
    '{count} скоро вернутся',
  ),
  home_summary_stale: ru3(
    '{count} ждёт ответа',
    '{count} ждут ответа',
    '{count} ждут ответа',
  ),
  dashboard_workspace_card_open: ru3(
    '{count} открытый',
    '{count} открытых',
    '{count} открытых',
  ),
  dashboard_workspace_card_channels: ru3(
    '{count} канал',
    '{count} канала',
    '{count} каналов',
  ),
  dashboard_workspace_card_contacts: ru3(
    '{count} контакт',
    '{count} контакта',
    '{count} контактов',
  ),
  dashboard_workspace_card_unread_aria: ru3(
    '{count} непрочитанное сообщение',
    '{count} непрочитанных сообщения',
    '{count} непрочитанных сообщений',
  ),
  inbox_unread_aria_label: ru3(
    '{count} непрочитанное сообщение',
    '{count} непрочитанных сообщения',
    '{count} непрочитанных сообщений',
  ),
  notifications_unread_count_aria: ru3(
    '{count} непрочитанное сообщение',
    '{count} непрочитанных сообщения',
    '{count} непрочитанных сообщений',
  ),
  sidebar_workspace_unread_dot_aria: ru3(
    '{count} непрочитанное сообщение',
    '{count} непрочитанных сообщения',
    '{count} непрочитанных сообщений',
  ),
  home_attention_showing_top: variant(COUNT_AND_TOTAL, {
    'countPlural=one': 'Показан самый срочный из {total}',
    'countPlural=few': 'Показаны {count} самых срочных из {total}',
    'countPlural=many': 'Показаны {count} самых срочных из {total}',
    'countPlural=*': 'Показаны {count} самых срочных из {total}',
  }),
  inbox_new_messages_button: ru3(
    '{count} новое сообщение',
    '{count} новых сообщения',
    '{count} новых сообщений',
  ),
}

/**
 * Keys the plural variants above replace. `inbox_new_messages_button_one` and
 * `_many` existed only so a component could branch on the count itself, which
 * gets the Russian 2-vs-5 split wrong by construction — there is no ternary
 * that yields three forms.
 */
const REMOVED = ['inbox_new_messages_button_one', 'inbox_new_messages_button_many']

function apply(path, replacements) {
  const messages = JSON.parse(readFileSync(path, 'utf8'))
  for (const [key, value] of Object.entries(replacements)) {
    if (!(key in messages)) throw new Error(`${path}: unknown key "${key}"`)
    messages[key] = value
  }
  for (const key of REMOVED) delete messages[key]
  writeFileSync(path, `${JSON.stringify(messages, null, 2)}\n`)
  console.log(
    `${path}: rewrote ${Object.keys(replacements).length} messages as plural variants, removed ${REMOVED.length}`,
  )
}

apply(EN_PATH, EN_PLURALS)
apply(RU_PATH, RU_PLURALS)
