import { describe, expect, it } from 'vitest'
import {
  igMessageFingerprint,
  igReactionFingerprint,
  igReadFingerprint,
  normalizeInstagramMessage,
  type IgMessagingEvent,
} from './lib.ts'

describe('fingerprints', () => {
  it('builds kind-prefixed fingerprints per logical event', () => {
    expect(igMessageFingerprint('mid.1')).toBe('msg:mid.1')
    expect(
      igReactionFingerprint({
        sender: { id: 'IGSID1' },
        timestamp: 1753262000000,
        reaction: { mid: 'mid.1', action: 'react' },
      }),
    ).toBe('reaction:mid.1:IGSID1:react:1753262000000')
    expect(
      igReadFingerprint({ sender: { id: 'IGSID1' }, read: { mid: 'mid.9' } }),
    ).toBe('read:IGSID1:mid.9')
  })

  it('returns null when identity parts are missing', () => {
    expect(igReactionFingerprint({ reaction: { mid: 'mid.1' } })).toBeNull()
    expect(igReadFingerprint({ sender: { id: 'IGSID1' } } as IgMessagingEvent)).toBeNull()
  })
})

describe('normalizeInstagramMessage', () => {
  it('keeps every attachment, not just the first', () => {
    const result = normalizeInstagramMessage({
      mid: 'mid.multi',
      attachments: [
        { type: 'image', payload: { url: 'https://cdn/one.jpg' } },
        { type: 'image', payload: { url: 'https://cdn/two.jpg' } },
        { type: 'video', payload: { url: 'https://cdn/three.mp4' } },
      ],
    })
    expect(result.type).toBe('media')
    expect(result.attachments).toHaveLength(3)
    expect(result.attachments.map((a) => a.url)).toEqual([
      'https://cdn/one.jpg',
      'https://cdn/two.jpg',
      'https://cdn/three.mp4',
    ])
  })

  it('classifies story replies with quote context', () => {
    const result = normalizeInstagramMessage({
      mid: 'mid.story',
      text: 'nice story!',
      reply_to: { story: { id: 'story-1', url: 'https://cdn/story.mp4' } },
    })
    expect(result.type).toBe('story_reply')
    expect(result.metadata.story).toEqual({
      kind: 'reply',
      id: 'story-1',
      url: 'https://cdn/story.mp4',
    })
  })

  it('classifies story mentions and shares', () => {
    const mention = normalizeInstagramMessage({
      mid: 'mid.mention',
      attachments: [{ type: 'story_mention', payload: { url: 'https://cdn/s.jpg' } }],
    })
    expect(mention.type).toBe('story_mention')
    expect(mention.metadata.story).toEqual({ kind: 'mention', url: 'https://cdn/s.jpg' })

    const share = normalizeInstagramMessage({
      mid: 'mid.share',
      attachments: [
        { type: 'ig_reel', payload: { url: 'https://cdn/reel.mp4', title: 'A reel' } },
      ],
    })
    expect(share.type).toBe('share')
    expect(share.metadata.share).toEqual({
      kind: 'ig_reel',
      url: 'https://cdn/reel.mp4',
      title: 'A reel',
    })
  })

  it('keeps reply context as an external target', () => {
    const result = normalizeInstagramMessage({
      mid: 'mid.reply',
      text: 'replying',
      reply_to: { mid: 'mid.parent' },
    })
    expect(result.type).toBe('text')
    expect(result.externalReplyToId).toBe('mid.parent')
    expect(result.metadata.quote).toEqual({ external_id: 'mid.parent' })
  })

  it('marks unsupported flags and unknown payloads explicitly', () => {
    const flagged = normalizeInstagramMessage({
      mid: 'mid.unsupported',
      is_unsupported: true,
    })
    expect(flagged.type).toBe('unsupported')
    expect(flagged.metadata.unsupported).toEqual({ kind: 'instagram_unsupported' })

    const empty = normalizeInstagramMessage({ mid: 'mid.empty' })
    expect(empty.type).toBe('unsupported')
    expect(empty.metadata.unsupported).toEqual({ kind: 'unknown_payload' })
  })

  it('preserves referral metadata', () => {
    const result = normalizeInstagramMessage({
      mid: 'mid.ref',
      text: 'from ad',
      referral: {
        type: 'OPEN_THREAD',
        source: 'ADS',
        ref: 'ref-1',
        ads_context_data: { ad_title: 'Summer promo' },
      },
    })
    expect(result.metadata.referral).toEqual({
      type: 'OPEN_THREAD',
      source: 'ADS',
      ref: 'ref-1',
      ad_title: 'Summer promo',
    })
  })
})
