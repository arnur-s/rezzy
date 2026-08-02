import { parseSharedContacts } from '@/entities/message'
import { setLocale } from '@/paraglide/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  listPreviewFromMessage,
  parseInteractiveMetadata,
  parseLocationMetadata,
  parseQuoteMetadata,
  parseShareMetadata,
  parseStoryMetadata,
  parseUnsupportedMetadata,
} from './message-metadata'

beforeEach(() => {
  setLocale('en', { reload: false })
})

describe('structured metadata parsers', () => {
  it('parses locations and rejects malformed coordinates', () => {
    expect(
      parseLocationMetadata({ location: { kind: 'point', latitude: 51.1, longitude: 71.4 } }),
    ).toEqual(expect.objectContaining({ latitude: 51.1, longitude: 71.4 }))
    expect(parseLocationMetadata({ location: { latitude: 'x' } })).toBeNull()
    expect(parseLocationMetadata({})).toBeNull()
    expect(parseLocationMetadata(null)).toBeNull()
  })

  it('parses contact cards from both provider shapes', () => {
    expect(
      parseSharedContacts({
        contacts: [
          { name: 'Dana', phones: [{ wa_id: '77015550001' }] },
          { first_name: 'Aizhan', phone: '+77015550002' },
        ],
      }),
    ).toHaveLength(2)
    expect(parseSharedContacts({ contacts: 'nope' })).toEqual([])
  })

  it('parses interactive, share, story, quote, and unsupported sections', () => {
    expect(
      parseInteractiveMetadata({ interactive: { kind: 'button_reply', id: 'b1' } }),
    ).toEqual(expect.objectContaining({ kind: 'button_reply', id: 'b1' }))
    expect(parseShareMetadata({ share: { kind: 'ig_reel', url: 'https://x' } })).toEqual(
      expect.objectContaining({ kind: 'ig_reel' }),
    )
    expect(parseStoryMetadata({ story: { kind: 'mention', url: 'https://x' } })).toEqual(
      expect.objectContaining({ kind: 'mention' }),
    )
    expect(
      parseQuoteMetadata({ quote: { external_id: '55', preview: 'hi' } }),
    ).toEqual(expect.objectContaining({ external_id: '55' }))
    expect(
      parseUnsupportedMetadata({ unsupported: { kind: 'poll', preview: 'Lunch?' } }),
    ).toEqual({ kind: 'poll', preview: 'Lunch?' })
    expect(parseInteractiveMetadata({})).toBeNull()
  })
})

describe('listPreviewFromMessage fallbacks', () => {
  const base = {
    content: null,
    metadata: {},
    media_filename: null,
    media_mime_type: null,
  }

  it('produces localized previews for the new types', () => {
    expect(listPreviewFromMessage({ ...base, type: 'location' })).toBe(
      'Location',
    )
    expect(listPreviewFromMessage({ ...base, type: 'contact' })).toBe('Contact')
    expect(listPreviewFromMessage({ ...base, type: 'unsupported' })).toBe(
      'Unsupported message',
    )
    expect(listPreviewFromMessage({ ...base, type: 'story_reply' })).toBe(
      'Story reply',
    )
  })

  it('still prefers trimmed content and handles unknown types safely', () => {
    expect(
      listPreviewFromMessage({ ...base, type: 'location', content: '  hi  ' }),
    ).toBe('hi')
    expect(listPreviewFromMessage({ ...base, type: 'weird_future_type' })).toBeNull()
  })
})
