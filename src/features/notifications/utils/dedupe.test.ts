import { describe, expect, it } from 'vitest'
import { NotificationDeduper } from './dedupe'

describe('NotificationDeduper', () => {
  it('accepts a new id once and rejects repeats', () => {
    const deduper = new NotificationDeduper()
    expect(deduper.add('a')).toBe(true)
    expect(deduper.add('a')).toBe(false)
    expect(deduper.has('a')).toBe(true)
    expect(deduper.has('b')).toBe(false)
  })

  it('evicts the oldest id past capacity', () => {
    const deduper = new NotificationDeduper(2)
    deduper.add('a')
    deduper.add('b')
    deduper.add('c') // evicts 'a'
    expect(deduper.has('a')).toBe(false)
    expect(deduper.has('b')).toBe(true)
    expect(deduper.has('c')).toBe(true)
    // 'a' is treated as new again after eviction
    expect(deduper.add('a')).toBe(true)
  })

  it('clears all recorded ids', () => {
    const deduper = new NotificationDeduper()
    deduper.add('a')
    deduper.clear()
    expect(deduper.has('a')).toBe(false)
    expect(deduper.add('a')).toBe(true)
  })
})
