import { describe, expect, it } from 'vitest'
import { m } from '@/paraglide/messages'

/**
 * Russian is `baseLocale`, and Russian counts take three forms: one (1, 21,
 * 101), few (2-4, 22-24) and many (5-20, 11-14, 25-30). Every counted message
 * used to carry a single fixed form, so the primary locale rendered
 * "1 каналов" and "2 контактов" — a class of bug that is invisible in English
 * and reads as broken software to a Russian speaker.
 *
 * These assertions pin the exact form per bucket rather than merely asserting
 * "the string differs", so a future edit that fixes one arm and leaves another
 * stale still fails here.
 */

/** 1 → one, 2 → few, 5 → many, 21 → one, 11 → many. */
const BUCKETS = [
  { count: 1, category: 'one' },
  { count: 2, category: 'few' },
  { count: 5, category: 'many' },
  { count: 11, category: 'many' },
  { count: 21, category: 'one' },
  { count: 22, category: 'few' },
  { count: 100, category: 'many' },
] as const

describe('Intl plural categories the messages are written against', () => {
  it('matches the categories the ru catalogue declares', () => {
    const rules = new Intl.PluralRules('ru')
    for (const { count, category } of BUCKETS) {
      expect(rules.select(count), `ru ${count}`).toBe(category)
    }
  })
})

describe('ru counted messages agree with their number', () => {
  const ru = { locale: 'ru' } as const

  it('declines channel and contact counts on the workspace card', () => {
    expect(m.dashboard_workspace_card_channels({ count: 1 }, ru)).toBe('1 канал')
    expect(m.dashboard_workspace_card_channels({ count: 2 }, ru)).toBe('2 канала')
    expect(m.dashboard_workspace_card_channels({ count: 5 }, ru)).toBe('5 каналов')
    expect(m.dashboard_workspace_card_channels({ count: 11 }, ru)).toBe('11 каналов')
    expect(m.dashboard_workspace_card_channels({ count: 21 }, ru)).toBe('21 канал')

    expect(m.dashboard_workspace_card_contacts({ count: 1 }, ru)).toBe('1 контакт')
    expect(m.dashboard_workspace_card_contacts({ count: 3 }, ru)).toBe('3 контакта')
    expect(m.dashboard_workspace_card_contacts({ count: 7 }, ru)).toBe('7 контактов')
  })

  it('declines the unread announcements screen readers read out', () => {
    expect(m.inbox_unread_aria_label({ count: 1 }, ru)).toBe(
      '1 непрочитанное сообщение',
    )
    expect(m.inbox_unread_aria_label({ count: 3 }, ru)).toBe(
      '3 непрочитанных сообщения',
    )
    expect(m.inbox_unread_aria_label({ count: 9 }, ru)).toBe(
      '9 непрочитанных сообщений',
    )
  })

  it('declines the home summary segments', () => {
    expect(m.home_summary_open({ count: 1 }, ru)).toBe(
      '1 открытый диалог на вас',
    )
    expect(m.home_summary_open({ count: 4 }, ru)).toBe(
      '4 открытых диалога на вас',
    )
    expect(m.home_summary_open({ count: 7 }, ru)).toBe(
      '7 открытых диалогов на вас',
    )
    // The horizons are part of the sentence now, not a hover-only tooltip,
    // so the plural forms have to survive the longer copy.
    expect(m.home_summary_waking({ count: 1 }, ru)).toBe(
      '1 отложенный вернётся в течение суток',
    )
    expect(m.home_summary_waking({ count: 3 }, ru)).toBe(
      '3 отложенных вернутся в течение суток',
    )
    expect(m.home_summary_waking({ count: 5 }, ru)).toBe(
      '5 отложенных вернутся в течение суток',
    )
    expect(m.home_summary_stale({ count: 1 }, ru)).toBe(
      '1 ждёт ответа больше 2 дней',
    )
    expect(m.home_summary_stale({ count: 3 }, ru)).toBe(
      '3 ждут ответа больше 2 дней',
    )
    expect(m.home_summary_stale({ count: 6 }, ru)).toBe(
      '6 ждут ответа больше 2 дней',
    )
  })

  it('drops the redundant count when the attention list shows exactly one', () => {
    expect(m.home_attention_showing_top({ count: 1, total: 12 }, ru)).toBe(
      'Показан самый срочный из 12',
    )
    expect(m.home_attention_showing_top({ count: 10, total: 42 }, ru)).toBe(
      'Показаны 10 самых срочных из 42',
    )
  })

  it('declines the new-messages jump button', () => {
    expect(m.inbox_new_messages_button({ count: 1 }, ru)).toBe(
      '1 новое сообщение',
    )
    expect(m.inbox_new_messages_button({ count: 2 }, ru)).toBe(
      '2 новых сообщения',
    )
    expect(m.inbox_new_messages_button({ count: 5 }, ru)).toBe(
      '5 новых сообщений',
    )
  })

  it('declines the conversation count in the archive confirmation', () => {
    expect(m.contact_archive_description({ count: 1 }, ru)).toContain(
      'и 1 диалог пропадут',
    )
    expect(m.contact_archive_description({ count: 3 }, ru)).toContain(
      'и 3 диалога пропадут',
    )
    expect(m.contact_archive_description({ count: 8 }, ru)).toContain(
      'и 8 диалогов пропадут',
    )
    expect(m.contact_archive_description({ count: 21 }, ru)).toContain(
      'и 21 диалог пропадут',
    )
  })

  it('promises the archive is reversible rather than final', () => {
    // The copy is load-bearing, not decoration: an archived contact returns by
    // itself on the next inbound message, so wording this as a deletion would
    // make that reappearance read as a bug.
    for (const body of [
      m.contact_archive_description({ count: 2 }, ru),
      m.contact_archive_description_none(ru),
    ]) {
      expect(body).toContain('вернётся сам')
      expect(body).not.toContain('Удал')
      expect(body).not.toContain('удал')
    }
  })

  it('declines the conversation count on an archived row', () => {
    expect(m.contacts_archived_conversations({ count: 1 }, ru)).toBe('1 диалог')
    expect(m.contacts_archived_conversations({ count: 2 }, ru)).toBe(
      '2 диалога',
    )
    expect(m.contacts_archived_conversations({ count: 5 }, ru)).toBe(
      '5 диалогов',
    )
    expect(m.contacts_archived_conversations({ count: 11 }, ru)).toBe(
      '11 диалогов',
    )
    expect(m.contacts_archived_conversations({ count: 21 }, ru)).toBe(
      '21 диалог',
    )
  })

  it('declines the notification group expand action', () => {
    expect(m.notifications_group_expand({ count: 1 }, ru)).toBe(
      'Показать ещё 1 сообщение',
    )
    expect(m.notifications_group_expand({ count: 2 }, ru)).toBe(
      'Показать ещё 2 сообщения',
    )
    expect(m.notifications_group_expand({ count: 5 }, ru)).toBe(
      'Показать ещё 5 сообщений',
    )
    expect(m.notifications_group_expand({ count: 21 }, ru)).toBe(
      'Показать ещё 21 сообщение',
    )
  })

  it('declines what a merge moves', () => {
    expect(m.contacts_merge_moves_conversations({ count: 1 }, ru)).toBe('1 диалог')
    expect(m.contacts_merge_moves_conversations({ count: 3 }, ru)).toBe('3 диалога')
    expect(m.contacts_merge_moves_conversations({ count: 8 }, ru)).toBe('8 диалогов')
    expect(m.contacts_merge_moves_conversations({ count: 21 }, ru)).toBe('21 диалог')

    expect(m.contacts_merge_moves_notes({ count: 1 }, ru)).toBe('1 заметка')
    expect(m.contacts_merge_moves_notes({ count: 2 }, ru)).toBe('2 заметки')
    expect(m.contacts_merge_moves_notes({ count: 6 }, ru)).toBe('6 заметок')

    expect(m.contacts_merge_moves_phones({ count: 1 }, ru)).toBe('1 номер')
    expect(m.contacts_merge_moves_phones({ count: 2 }, ru)).toBe('2 номера')
    expect(m.contacts_merge_moves_phones({ count: 5 }, ru)).toBe('5 номеров')

    expect(m.contacts_merge_moves_channels({ count: 1 }, ru)).toBe('1 канал')
    expect(m.contacts_merge_moves_channels({ count: 2 }, ru)).toBe('2 канала')
    expect(m.contacts_merge_moves_channels({ count: 5 }, ru)).toBe('5 каналов')
  })

  it('declines the duplicate counts', () => {
    expect(m.contacts_duplicates_count({ count: 1 }, ru)).toBe('1 совпадение')
    expect(m.contacts_duplicates_count({ count: 2 }, ru)).toBe('2 совпадения')
    expect(m.contacts_duplicates_count({ count: 7 }, ru)).toBe('7 совпадений')
    expect(m.contacts_duplicates_count({ count: 21 }, ru)).toBe('21 совпадение')

    expect(m.contacts_duplicates_group_size({ count: 2 }, ru)).toBe('2 контакта')
    expect(m.contacts_duplicates_group_size({ count: 5 }, ru)).toBe('5 контактов')
  })

  it('conjugates the merge-moves verb by the total item count, not the category count', () => {
    // The subject is a compound noun phrase built from the summary, but the
    // verb agrees with the total number of things moving. A count of 1 is
    // the one-item case ("Перейдёт" -- singular future); everything else,
    // including a plural-looking but still-small count like 2, takes the
    // plural ("Перейдут").
    expect(
      m.contacts_merge_confirm_moves(
        { count: 1, survivor: 'Ivan', summary: '1 диалог' },
        ru,
      ),
    ).toBe('Перейдёт к «Ivan»: 1 диалог.')
    expect(
      m.contacts_merge_confirm_moves(
        { count: 2, survivor: 'Ivan', summary: '2 диалога' },
        ru,
      ),
    ).toBe('Перейдут к «Ivan»: 2 диалога.')
    expect(
      m.contacts_merge_confirm_moves(
        { count: 5, survivor: 'Ivan', summary: '5 диалогов' },
        ru,
      ),
    ).toBe('Перейдут к «Ivan»: 5 диалогов.')
  })

  it('says the merge cannot be undone, in the base locale', () => {
    // The whole design turns on this sentence being true and being read. An
    // archived contact comes back by itself; a merged one does not.
    expect(m.contacts_merge_confirm_irreversible(ru)).toContain('нельзя отменить')
  })
})

describe('en counted messages agree with their number', () => {
  const en = { locale: 'en' } as const

  it('singularizes at one', () => {
    expect(m.dashboard_workspace_card_channels({ count: 1 }, en)).toBe('1 channel')
    expect(m.dashboard_workspace_card_channels({ count: 4 }, en)).toBe('4 channels')
    expect(m.dashboard_workspace_card_contacts({ count: 1 }, en)).toBe('1 contact')
    expect(m.dashboard_workspace_card_contacts({ count: 2 }, en)).toBe('2 contacts')
    expect(m.inbox_unread_aria_label({ count: 1 }, en)).toBe('1 unread message')
    expect(m.inbox_unread_aria_label({ count: 3 }, en)).toBe('3 unread messages')
  })

  it('drops the redundant count when the attention list shows exactly one', () => {
    expect(m.home_attention_showing_top({ count: 1, total: 12 }, en)).toBe(
      'Showing the most urgent of 12',
    )
    expect(m.home_attention_showing_top({ count: 10, total: 42 }, en)).toBe(
      'Showing the 10 most urgent of 42',
    )
  })
})
