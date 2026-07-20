const EMOJI_PATTERN = /\p{Extended_Pictographic}/u

export type MessageSegment = {
  type: 'text' | 'emoji'
  value: string
}

export function segmentGraphemes(text: string): Array<string> {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return [...segmenter.segment(text)].map((s) => s.segment)
  }
  return [...text]
}

export function isEmojiGrapheme(grapheme: string): boolean {
  return EMOJI_PATTERN.test(grapheme)
}

export function containsEmoji(text: string): boolean {
  return segmentGraphemes(text).some(isEmojiGrapheme)
}

export function isEmojiOnlyMessage(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const graphemes = segmentGraphemes(trimmed).filter((g) => g.trim() !== '')
  return graphemes.length > 0 && graphemes.every(isEmojiGrapheme)
}

export function countEmojiGraphemes(text: string): number {
  return segmentGraphemes(text).filter(isEmojiGrapheme).length
}

export function splitMessageSegments(text: string): Array<MessageSegment> {
  if (!text) return []

  const segments: Array<MessageSegment> = []
  let currentType: MessageSegment['type'] | null = null
  let currentValue = ''

  for (const grapheme of segmentGraphemes(text)) {
    const type: MessageSegment['type'] = isEmojiGrapheme(grapheme)
      ? 'emoji'
      : 'text'

    if (type === currentType) {
      currentValue += grapheme
    } else {
      if (currentType !== null) {
        segments.push({ type: currentType, value: currentValue })
      }
      currentType = type
      currentValue = grapheme
    }
  }

  if (currentType !== null) {
    segments.push({ type: currentType, value: currentValue })
  }

  return segments
}
