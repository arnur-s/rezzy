import { describe, expect, it } from 'vitest'
import {
  containsEmoji,
  isEmojiGrapheme,
  isEmojiOnlyMessage,
  segmentGraphemes,
  splitMessageSegments,
} from './emoji-text'

describe('isEmojiGrapheme', () => {
  it('detects a single emoji', () => {
    expect(isEmojiGrapheme('👋')).toBe(true)
  })

  it('rejects plain text', () => {
    expect(isEmojiGrapheme('a')).toBe(false)
  })
})

describe('segmentGraphemes', () => {
  it('keeps ZWJ family as one grapheme', () => {
    const family = '👨‍👩‍👧'
    const graphemes = segmentGraphemes(family)
    expect(graphemes).toHaveLength(1)
    expect(isEmojiGrapheme(graphemes[0]!)).toBe(true)
  })
})

describe('containsEmoji', () => {
  it('returns true for mixed text', () => {
    expect(containsEmoji('Hello 👋')).toBe(true)
  })

  it('returns false for plain text', () => {
    expect(containsEmoji('Hello')).toBe(false)
  })
})

describe('isEmojiOnlyMessage', () => {
  it('returns true for emoji with spaces', () => {
    expect(isEmojiOnlyMessage('😀 😀')).toBe(true)
  })

  it('returns false for mixed content', () => {
    expect(isEmojiOnlyMessage('Hi 👋')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isEmojiOnlyMessage('')).toBe(false)
    expect(isEmojiOnlyMessage('   ')).toBe(false)
  })
})

describe('splitMessageSegments', () => {
  it('returns empty array for empty string', () => {
    expect(splitMessageSegments('')).toEqual([])
  })

  it('splits plain text into one segment', () => {
    expect(splitMessageSegments('Hello')).toEqual([
      { type: 'text', value: 'Hello' },
    ])
  })

  it('splits mixed text and emoji', () => {
    expect(splitMessageSegments('Hello 👋')).toEqual([
      { type: 'text', value: 'Hello ' },
      { type: 'emoji', value: '👋' },
    ])
  })

  it('merges adjacent emoji graphemes', () => {
    expect(splitMessageSegments('👋😀')).toEqual([
      { type: 'emoji', value: '👋😀' },
    ])
  })
})
