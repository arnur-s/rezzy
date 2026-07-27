import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MessageThreadEmpty } from './message-thread-empty'

describe('MessageThreadEmpty', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  /**
   * The pane used to say "Pick a conversation" unconditionally, including on a
   * workspace with no conversations at all — an instruction to choose from an
   * empty list, which sends the reader looking for a control that is not there.
   */
  it('does not invite a choice when there is nothing to choose from', () => {
    render(<MessageThreadEmpty hasNoConversations />)
    expect(
      screen.getByText(m.inbox_empty_no_conversations_title()),
    ).toBeTruthy()
    expect(
      screen.queryByText(m.inbox_empty_select_conversation_title()),
    ).toBeNull()
  })

  it('invites a choice once conversations exist', () => {
    render(<MessageThreadEmpty />)
    expect(
      screen.getByText(m.inbox_empty_select_conversation_title()),
    ).toBeTruthy()
    expect(
      screen.queryByText(m.inbox_empty_no_conversations_title()),
    ).toBeNull()
  })

  it('says something new in the description rather than restating the title', () => {
    render(<MessageThreadEmpty />)
    const title = m.inbox_empty_select_conversation_title()
    const description = m.inbox_empty_select_conversation_description()
    expect(description.toLowerCase()).not.toContain(title.toLowerCase())
  })
})
