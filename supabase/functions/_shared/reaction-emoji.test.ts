import { describe, expect, it } from 'vitest'
import { normalizeReactionEmoji as normalizeInEdge } from './reaction-emoji.ts'
// The app's copy. Deno cannot import from `src/`, so the two implementations are
// duplicated on purpose; this test is what keeps them from drifting apart.
import { normalizeReactionEmoji as normalizeInApp } from '../../../src/lib/reaction-emoji'

// Reaction bugs live in characters nobody can see in a diff, so every sequence
// under test is spelled out by code point instead of pasted in.
const VS15 = String.fromCodePoint(0xfe0e) // text presentation selector
const VS16 = String.fromCodePoint(0xfe0f) // emoji presentation selector
const ZWJ = String.fromCodePoint(0x200d)
const HEART = String.fromCodePoint(0x2764) // ❤
const FROWN = String.fromCodePoint(0x2639) // ☹
const THUMBS_UP = String.fromCodePoint(0x1f44d) // 👍
const TONE_4 = String.fromCodePoint(0x1f3fd) // 🏽 skin-tone modifier
const KEYCAP = String.fromCodePoint(0x20e3)
const FAMILY = [0x1f468, 0x1f469, 0x1f467, 0x1f466] // 👨‍👩‍👧‍👦
  .map((point) => String.fromCodePoint(point))
  .join(ZWJ)
const FLAG_KZ = String.fromCodePoint(0x1f1f0, 0x1f1ff) // 🇰🇿

const implementations = [
  ['edge runtime', normalizeInEdge],
  ['app', normalizeInApp],
] as const

describe.each(implementations)('normalizeReactionEmoji (%s)', (_name, normalize) => {
  it('collapses the WhatsApp and Telegram spellings of one emoji', () => {
    expect(normalize(HEART + VS16)).toBe(HEART)
    expect(normalize(HEART)).toBe(HEART)
    expect(normalize(HEART + VS16)).toBe(normalize(HEART))
  })

  it('drops the text presentation selector as well', () => {
    // U+FE0E asks for the monochrome glyph. It is presentation, not identity.
    expect(normalize(FROWN + VS16)).toBe(normalize(FROWN))
    expect(normalize(FROWN + VS15)).toBe(normalize(FROWN))
  })

  it('keeps skin-tone modifiers', () => {
    // Stripping the modifier would merge two reactions a person chose apart.
    expect(normalize(THUMBS_UP + TONE_4)).toBe(THUMBS_UP + TONE_4)
    expect(normalize(THUMBS_UP + TONE_4)).not.toBe(normalize(THUMBS_UP))
  })

  it('keeps zero-width joiner sequences', () => {
    expect(normalize(FAMILY)).toBe(FAMILY)
    expect([...normalize(FAMILY)]).toHaveLength(7)
  })

  it('keeps regional indicator pairs', () => {
    expect(normalize(FLAG_KZ)).toBe(FLAG_KZ)
  })

  it('keeps the combining keycap that carries a keycap sequence', () => {
    // Only the selector goes; U+20E3 is what makes it a keycap at all.
    expect(normalize('1' + VS16 + KEYCAP)).toBe('1' + KEYCAP)
  })

  it('applies NFC so decomposed text does not split an identity', () => {
    const decomposed = 'e' + String.fromCodePoint(0x0301)
    expect(normalize(decomposed)).toBe(String.fromCodePoint(0x00e9))
  })

  it('leaves opaque provider identifiers and ordinary text alone', () => {
    expect(normalize('custom:5309984423003823246')).toBe(
      'custom:5309984423003823246',
    )
    expect(normalize('love')).toBe('love')
    expect(normalize('Сердце')).toBe('Сердце')
  })

  it('trims surrounding whitespace so padding is not part of the identity', () => {
    expect(normalize(` ${HEART + VS16} `)).toBe(HEART)
    expect(normalize('   ')).toBe('')
  })
})

describe('normalization parity across runtimes', () => {
  it('agrees on every sequence the pipeline can store', () => {
    const samples = [
      HEART,
      HEART + VS16,
      HEART + VS15,
      FROWN,
      FROWN + VS16,
      THUMBS_UP,
      THUMBS_UP + TONE_4,
      FAMILY,
      FLAG_KZ,
      '1' + VS16 + KEYCAP,
      String.fromCodePoint(0x2b50), // ⭐, Telegram paid reactions
      'custom:5309984423003823246',
      'love',
      '',
      ' ',
    ]
    for (const sample of samples) {
      expect(normalizeInEdge(sample)).toBe(normalizeInApp(sample))
    }
  })
})
