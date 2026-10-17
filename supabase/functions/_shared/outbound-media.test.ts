import { describe, expect, it } from 'vitest'
import { isOutboundMediaPath } from './outbound-media.ts'

describe('outbound media authorization', () => {
  it.each([
    'workspace/conversation/file.pdf',
    'workspace/conversation/message/file.pdf',
  ])('allows existing supported path shape %s', (path) =>
    expect(isOutboundMediaPath(path, 'workspace', 'conversation')).toBe(true),
  )

  it.each([
    'other/conversation/message/file.pdf',
    'workspace/other/message/file.pdf',
    'workspace/conversation/../file.pdf',
    'workspace/conversation/%2e%2e/file.pdf',
    'workspace/conversation/message/..\\file.pdf',
    'workspace/conversation//file.pdf',
    'workspace/conversation/message/file.pdf?download=1',
    'workspace/conversation/message/file.pdf#fragment',
    'https://example.com/file.pdf',
  ])('refuses a foreign or ambiguous path %s', (path) => {
    expect(isOutboundMediaPath(path, 'workspace', 'conversation')).toBe(false)
  })
})
