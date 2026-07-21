import { describe, expect, it } from 'vitest'
import { shouldPresentInApp } from './should-notify'

const notification = { workspace_id: 'w1', conversation_id: 'c1' }

describe('shouldPresentInApp', () => {
  it('suppresses when focused and viewing the exact thread', () => {
    expect(
      shouldPresentInApp({
        inAppEnabled: true,
        isFocused: true,
        openWorkspaceId: 'w1',
        openConversationId: 'c1',
        notification,
      }),
    ).toBe(false)
  })

  it('shows for a different thread in the same workspace', () => {
    expect(
      shouldPresentInApp({
        inAppEnabled: true,
        isFocused: true,
        openWorkspaceId: 'w1',
        openConversationId: 'other',
        notification,
      }),
    ).toBe(true)
  })

  it('shows when viewing a different workspace', () => {
    expect(
      shouldPresentInApp({
        inAppEnabled: true,
        isFocused: true,
        openWorkspaceId: 'w2',
        openConversationId: 'c1',
        notification,
      }),
    ).toBe(true)
  })

  it('does not show an in-app notification when the tab is unfocused (hidden, minimized, or another app is active)', () => {
    expect(
      shouldPresentInApp({
        inAppEnabled: true,
        isFocused: false,
        openWorkspaceId: null,
        openConversationId: null,
        notification,
      }),
    ).toBe(false)
  })

  it('does not show when in-app notifications are disabled', () => {
    expect(
      shouldPresentInApp({
        inAppEnabled: false,
        isFocused: true,
        openWorkspaceId: 'w2',
        openConversationId: 'other',
        notification,
      }),
    ).toBe(false)
  })
})
