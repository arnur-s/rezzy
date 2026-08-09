import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Length guards for strings that sit inside a fixed-width control.
 *
 * Russian runs roughly 15-30% longer than English for the same sentence, so a
 * control sized against the English copy silently truncates the base locale.
 * That is exactly what happened to the notification preview select, which
 * rendered "Показывать сообще…" on a `w-48` box.
 *
 * These read the catalogues directly rather than rendering: jsdom has no
 * layout, so a rendered assertion could not see the overflow either. The
 * budgets are character counts tied to the control each string lives in, and
 * they are deliberately generous — they catch a new translation that is twice
 * as long, not one that is two characters over.
 */

type Catalogue = Record<string, unknown>

const en = JSON.parse(readFileSync('messages/en.json', 'utf8')) as Catalogue
const ru = JSON.parse(readFileSync('messages/ru.json', 'utf8')) as Catalogue

/** Message IDs that render inside a width-constrained control. */
const BUDGETS: Array<{ key: string; max: number; where: string }> = [
  // The three options of the message-preview select. It sits beside a
  // description in a settings row, so it cannot grow indefinitely.
  { key: 'settings_notifications_preview_full_label', max: 24, where: 'preview select' },
  { key: 'settings_notifications_preview_sender_label', max: 24, where: 'preview select' },
  { key: 'settings_notifications_preview_hidden_label', max: 24, where: 'preview select' },
  // Segmented controls put every option on one row, so the whole set has to fit.
  { key: 'settings_appearance_mode_system', max: 16, where: 'theme segmented control' },
  { key: 'settings_appearance_mode_light', max: 16, where: 'theme segmented control' },
  { key: 'settings_appearance_mode_dark', max: 16, where: 'theme segmented control' },
  { key: 'settings_appearance_language_auto', max: 16, where: 'language segmented control' },
  // Inbox filter chips, all on one row above the conversation list.
  { key: 'inbox_filter_all', max: 14, where: 'inbox filter row' },
  { key: 'inbox_filter_mine', max: 14, where: 'inbox filter row' },
  { key: 'inbox_filter_unassigned', max: 20, where: 'inbox filter row' },
  // Status chips render inline next to a contact name.
  { key: 'inbox_status_open', max: 14, where: 'status chip' },
  { key: 'inbox_status_closed', max: 14, where: 'status chip' },
  { key: 'inbox_status_snoozed', max: 14, where: 'status chip' },
  // The thread header's assignee trigger truncates its label at `max-w-28`
  // (112px), which is roughly 18 characters at the 12px metadata size. A member
  // name is expected to truncate there — it has a face beside it and a hover
  // card behind it — but these two stand in for the *state*, so a clipped one
  // would leave the control saying nothing.
  { key: 'inbox_assignee_assign_cta', max: 18, where: 'assignee trigger' },
  { key: 'inbox_assignee_former_member', max: 18, where: 'assignee trigger' },
  // Attention-queue reason chips sit inline beside a truncating name.
  { key: 'home_attention_reason_snoozed', max: 20, where: 'attention reason chip' },
  { key: 'home_attention_reason_unread', max: 20, where: 'attention reason chip' },
  { key: 'home_attention_reason_stale', max: 20, where: 'attention reason chip' },
  // The shared-contact card's action sits inside a message bubble, which is
  // capped at a fraction of the thread width and is narrowest on a phone. A
  // button does not wrap its label, so an over-long one widens the bubble or
  // spills out of it.
  { key: 'inbox_shared_contact_create', max: 24, where: 'shared contact card action' },
  { key: 'inbox_shared_contact_open', max: 24, where: 'shared contact card action' },
  { key: 'inbox_shared_contact_review', max: 24, where: 'shared contact card action' },
  { key: 'inbox_shared_contact_add_phones', max: 24, where: 'shared contact card action' },
  { key: 'inbox_shared_contact_checking', max: 24, where: 'shared contact card action' },
  { key: 'inbox_shared_contact_copy_details', max: 24, where: 'shared contact card action' },
  { key: 'inbox_shared_contact_lookup_failed', max: 32, where: 'shared contact card status' },
]

describe('strings inside fixed-width controls stay within budget', () => {
  for (const { key, max, where } of BUDGETS) {
    it(`${key} fits the ${where} in both locales`, () => {
      for (const [locale, catalogue] of [
        ['en', en],
        ['ru', ru],
      ] as const) {
        const value = catalogue[key]
        expect(typeof value, `${locale}:${key} should be a simple message`).toBe(
          'string',
        )
        expect(
          (value as string).length,
          `${locale}:${key} = ${JSON.stringify(value)}`,
        ).toBeLessThanOrEqual(max)
      }
    })
  }
})
