import { beforeEach, describe, expect, it } from 'vitest'
import { buildMessageNotificationDetails } from '../model/notification-fixtures'
import {
  NOTIFICATION_GROUP_LIMIT,
  appendToNotificationGroup,
  clearNotificationGroup,
  getNotificationGroupPin,
  resetNotificationGroups,
  setNotificationGroupPin,
} from './notification-group-store'

function message(id: string, conversationId = 'c1') {
  return buildMessageNotificationDetails({ id, conversationId })
}

describe('notification group store', () => {
  beforeEach(() => {
    resetNotificationGroups()
  })

  it('starts a group at one message', () => {
    const group = appendToNotificationGroup(message('n1'))
    expect(group.items.map((item) => item.id)).toEqual(['n1'])
    expect(group.total).toBe(1)
  })

  it('accumulates messages for the same conversation, newest last', () => {
    appendToNotificationGroup(message('n1'))
    appendToNotificationGroup(message('n2'))
    const group = appendToNotificationGroup(message('n3'))
    expect(group.items.map((item) => item.id)).toEqual(['n1', 'n2', 'n3'])
    expect(group.total).toBe(3)
  })

  it('keeps conversations independent', () => {
    appendToNotificationGroup(message('n1', 'c1'))
    const other = appendToNotificationGroup(message('n2', 'c2'))
    expect(other.items.map((item) => item.id)).toEqual(['n2'])
    expect(other.total).toBe(1)
  })

  it('caps retained messages but keeps counting the total', () => {
    for (let index = 0; index < NOTIFICATION_GROUP_LIMIT + 3; index += 1) {
      appendToNotificationGroup(message(`n${index}`))
    }
    const group = appendToNotificationGroup(message('last'))
    expect(group.items).toHaveLength(NOTIFICATION_GROUP_LIMIT)
    expect(group.items[group.items.length - 1]?.id).toBe('last')
    expect(group.total).toBe(NOTIFICATION_GROUP_LIMIT + 4)
  })

  it('ignores a redelivered notification id', () => {
    appendToNotificationGroup(message('n1'))
    const group = appendToNotificationGroup(message('n1'))
    expect(group.items).toHaveLength(1)
    expect(group.total).toBe(1)
  })

  it('drops a group once its toast is gone', () => {
    appendToNotificationGroup(message('n1'))
    appendToNotificationGroup(message('n2'))
    clearNotificationGroup('c1')
    const group = appendToNotificationGroup(message('n3'))
    expect(group.items.map((item) => item.id)).toEqual(['n3'])
    expect(group.total).toBe(1)
  })

  it('returns a fresh object each time so React sees a change', () => {
    const first = appendToNotificationGroup(message('n1'))
    const second = appendToNotificationGroup(message('n2'))
    expect(second).not.toBe(first)
    expect(first.items).toHaveLength(1)
  })

  describe('expand pin', () => {
    it('has no opinion until one is recorded', () => {
      appendToNotificationGroup(message('n1'))
      expect(getNotificationGroupPin('c1')).toBeNull()
    })

    it('keeps a pin across regrouping, which is what remounts the toast', () => {
      appendToNotificationGroup(message('n1'))
      setNotificationGroupPin('c1', true)
      appendToNotificationGroup(message('n2'))
      expect(getNotificationGroupPin('c1')).toBe(true)
    })

    it('records an explicit collapse distinctly from no opinion', () => {
      setNotificationGroupPin('c1', false)
      expect(getNotificationGroupPin('c1')).toBe(false)
    })

    it('resets to no opinion on null', () => {
      setNotificationGroupPin('c1', true)
      setNotificationGroupPin('c1', null)
      expect(getNotificationGroupPin('c1')).toBeNull()
    })

    it('keeps pins independent per conversation', () => {
      setNotificationGroupPin('c1', true)
      expect(getNotificationGroupPin('c2')).toBeNull()
    })

    it('drops the pin with the group, so the next toast starts collapsed', () => {
      appendToNotificationGroup(message('n1'))
      setNotificationGroupPin('c1', true)
      clearNotificationGroup('c1')
      expect(getNotificationGroupPin('c1')).toBeNull()
    })
  })
})
