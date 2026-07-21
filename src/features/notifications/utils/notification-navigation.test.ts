import { describe, expect, it } from 'vitest'
import {
  notificationThreadPath,
  parseNotificationThreadPath,
} from './notification-navigation'

describe('notificationThreadPath', () => {
  it('builds a workspace + conversation thread path', () => {
    expect(
      notificationThreadPath({ workspaceId: 'w1', conversationId: 'c1' }),
    ).toBe('/workspaces/w1/inbox/c1')
  })
})

describe('parseNotificationThreadPath', () => {
  it('parses a path into ids', () => {
    expect(parseNotificationThreadPath('/workspaces/w1/inbox/c1')).toEqual({
      workspaceId: 'w1',
      conversationId: 'c1',
    })
  })

  it('parses an absolute URL with a query string', () => {
    expect(
      parseNotificationThreadPath(
        'https://app.example.com/workspaces/w1/inbox/c1?focus=1',
      ),
    ).toEqual({ workspaceId: 'w1', conversationId: 'c1' })
  })

  it('round-trips build -> parse', () => {
    const target = { workspaceId: 'ws-abc', conversationId: 'conv-xyz' }
    expect(parseNotificationThreadPath(notificationThreadPath(target))).toEqual(
      target,
    )
  })

  it('returns null for non-thread paths', () => {
    expect(parseNotificationThreadPath('/workspaces/w1/inbox')).toBeNull()
    expect(parseNotificationThreadPath('/settings')).toBeNull()
    expect(parseNotificationThreadPath('/workspaces/w1')).toBeNull()
  })
})
