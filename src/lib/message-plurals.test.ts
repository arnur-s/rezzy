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
    expect(m.home_summary_open({ count: 1 }, ru)).toBe('1 открытый на вас')
    expect(m.home_summary_open({ count: 4 }, ru)).toBe('4 открытых на вас')
    expect(m.home_summary_waking({ count: 1 }, ru)).toBe('1 скоро вернётся')
    expect(m.home_summary_waking({ count: 5 }, ru)).toBe('5 скоро вернутся')
    expect(m.home_summary_stale({ count: 1 }, ru)).toBe('1 ждёт ответа')
    expect(m.home_summary_stale({ count: 6 }, ru)).toBe('6 ждут ответа')
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
