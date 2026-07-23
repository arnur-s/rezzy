import { describe, expect, it } from 'vitest'
import { isProjectedStatus, shouldAdvanceStatus } from './status.ts'

describe('shouldAdvanceStatus', () => {
  it('advances through the delivery ladder', () => {
    expect(shouldAdvanceStatus(null, 'sent')).toBe(true)
    expect(shouldAdvanceStatus('sent', 'delivered')).toBe(true)
    expect(shouldAdvanceStatus('delivered', 'read')).toBe(true)
    expect(shouldAdvanceStatus('read', 'played')).toBe(true)
  })

  it('never regresses on out-of-order callbacks', () => {
    expect(shouldAdvanceStatus('read', 'delivered')).toBe(false)
    expect(shouldAdvanceStatus('played', 'read')).toBe(false)
    expect(shouldAdvanceStatus('delivered', 'sent')).toBe(false)
    expect(shouldAdvanceStatus('sent', 'sent')).toBe(false)
  })

  it('applies failed only before read/played', () => {
    expect(shouldAdvanceStatus('sent', 'failed')).toBe(true)
    expect(shouldAdvanceStatus('delivered', 'failed')).toBe(true)
    expect(shouldAdvanceStatus('read', 'failed')).toBe(false)
    expect(shouldAdvanceStatus('played', 'failed')).toBe(false)
    expect(shouldAdvanceStatus('failed', 'failed')).toBe(false)
  })

  it('keeps failed terminal', () => {
    expect(shouldAdvanceStatus('failed', 'delivered')).toBe(false)
    expect(shouldAdvanceStatus('failed', 'read')).toBe(false)
  })

  it('treats history-only statuses as non-projecting', () => {
    expect(shouldAdvanceStatus('sent', 'queued')).toBe(false)
    expect(shouldAdvanceStatus('sent', 'deleted')).toBe(false)
    expect(shouldAdvanceStatus('sent', 'unknown')).toBe(false)
    expect(isProjectedStatus('queued')).toBe(false)
    expect(isProjectedStatus('read')).toBe(true)
  })
})
