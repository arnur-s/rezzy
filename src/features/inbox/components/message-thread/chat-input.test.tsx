import { m } from '@/paraglide/messages'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatInput } from './chat-input'
import { clearConversationDraft } from '../../utils/conversation-drafts'

type VoiceInputOptions = {
  onResult: (text: string) => void
  onError?: (code: string) => void
  lang?: string
}

const voiceMock = vi.hoisted(() => {
  const startRecording = vi.fn()
  const stopRecording = vi.fn()
  const state: {
    isSupported: boolean
    isRecording: boolean
    interimText: string
    lastOptions: VoiceInputOptions | null
  } = {
    isSupported: true,
    isRecording: false,
    interimText: '',
    lastOptions: null,
  }

  function reset() {
    startRecording.mockReset()
    stopRecording.mockReset()
    state.isSupported = true
    state.isRecording = false
    state.interimText = ''
    state.lastOptions = null
  }

  return { startRecording, stopRecording, state, reset }
})

vi.mock('@/hooks/use-voice-input', () => ({
  useVoiceInput: (options: VoiceInputOptions) => {
    voiceMock.state.lastOptions = options
    return {
      isRecording: voiceMock.state.isRecording,
      interimText: voiceMock.state.interimText,
      startRecording: voiceMock.startRecording,
      stopRecording: voiceMock.stopRecording,
      isSupported: voiceMock.state.isSupported,
    }
  },
}))

vi.mock('@astryxdesign/core/Toast', () => ({
  useToast: () => vi.fn(),
}))

const micName = m.inbox_composer_voice_label()
const sendName = m.inbox_composer_send_label()
const attachName = m.inbox_composer_attach_file_label()

// `useIsMobile` reads a max-width media query, and the shared setup stubs
// `matchMedia` to never match. Re-stub it so a test can pick a viewport.
function setViewportIsMobile(isMobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isMobile && query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('ChatInput voice/send toggle', () => {
  beforeEach(() => {
    voiceMock.reset()
  })

  it('shows the mic button (not send) when the input is empty and voice is supported', () => {
    render(<ChatInput onSend={vi.fn()} />)

    expect(screen.getByRole('button', { name: micName })).toBeDefined()
    expect(screen.queryByRole('button', { name: sendName })).toBeNull()
  })

  it('shows the send button (not mic) once the user types text', () => {
    render(<ChatInput onSend={vi.fn()} />)

    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
    act(() => {
      fireEvent.change(textarea, { target: { value: 'hello' } })
    })

    expect(screen.getByRole('button', { name: sendName })).toBeDefined()
    expect(screen.queryByRole('button', { name: micName })).toBeNull()
  })

  it('hides the mic button when speech recognition is unsupported', () => {
    voiceMock.state.isSupported = false
    render(<ChatInput onSend={vi.fn()} />)

    expect(screen.queryByRole('button', { name: micName })).toBeNull()
    expect(screen.getByRole('button', { name: sendName })).toBeDefined()
  })

  it('starts recording on pointer down and stops on pointer up', () => {
    render(<ChatInput onSend={vi.fn()} />)

    const mic = screen.getByRole('button', { name: micName })

    fireEvent.pointerDown(mic, { button: 0, pointerId: 1 })
    expect(voiceMock.startRecording).toHaveBeenCalledOnce()

    fireEvent.pointerUp(mic, { button: 0, pointerId: 1 })
    expect(voiceMock.stopRecording).toHaveBeenCalledOnce()
  })

  it('does not start recording on right-click (non-primary button)', () => {
    render(<ChatInput onSend={vi.fn()} />)

    const mic = screen.getByRole('button', { name: micName })
    fireEvent.pointerDown(mic, { button: 2, pointerId: 1 })

    expect(voiceMock.startRecording).not.toHaveBeenCalled()
  })

  it('inserts the transcript into the input and switches to the send button', () => {
    render(<ChatInput onSend={vi.fn()} />)

    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')

    act(() => {
      voiceMock.state.lastOptions?.onResult('voice transcript')
    })

    expect(textarea.value).toBe('voice transcript')
    expect(screen.getByRole('button', { name: sendName })).toBeDefined()
    expect(screen.queryByRole('button', { name: micName })).toBeNull()
  })

  it('appends the transcript to existing text with a single space', () => {
    render(<ChatInput onSend={vi.fn()} />)

    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
    act(() => {
      fireEvent.change(textarea, { target: { value: 'hello' } })
    })

    act(() => {
      voiceMock.state.lastOptions?.onResult('world')
    })

    expect(textarea.value).toBe('hello world')
  })

  it('sends typed text on Enter without auto-sending the transcript', () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')

    act(() => {
      voiceMock.state.lastOptions?.onResult('dictated message')
    })

    expect(onSend).not.toHaveBeenCalled()
    expect(textarea.value).toBe('dictated message')

    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('dictated message', null)
  })

  it('dictates with the keyboard: Space starts and release stops recording', () => {
    render(<ChatInput onSend={vi.fn()} />)

    const mic = screen.getByRole('button', { name: micName })
    fireEvent.keyDown(mic, { key: ' ' })
    expect(voiceMock.startRecording).toHaveBeenCalledOnce()

    fireEvent.keyUp(mic, { key: ' ' })
    expect(voiceMock.stopRecording).toHaveBeenCalledOnce()
  })
})

describe('ChatInput draft safety', () => {
  beforeEach(() => {
    voiceMock.reset()
    clearConversationDraft('conversation-1')
  })

  it('never destroys typed text on Escape', () => {
    render(<ChatInput onSend={vi.fn()} />)

    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
    act(() => {
      fireEvent.change(textarea, { target: { value: 'a careful reply' } })
    })

    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(textarea.value).toBe('a careful reply')
  })

  it('Escape cancels the reply target instead of clearing text', () => {
    const onCancelReply = vi.fn()
    render(<ChatInput onSend={vi.fn()} onCancelReply={onCancelReply} />)

    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
    act(() => {
      fireEvent.change(textarea, { target: { value: 'draft' } })
    })

    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(onCancelReply).toHaveBeenCalledOnce()
    expect(textarea.value).toBe('draft')
  })

  it('restores the draft after the composer remounts (thread switch)', () => {
    const first = render(
      <ChatInput onSend={vi.fn()} draftKey="conversation-1" />,
    )

    act(() => {
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'unsent thoughts' },
      })
    })

    first.unmount()

    render(<ChatInput onSend={vi.fn()} draftKey="conversation-1" />)
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe(
      'unsent thoughts',
    )
  })

  it('clears the draft once the message is sent', () => {
    const onSend = vi.fn()
    const first = render(
      <ChatInput onSend={onSend} draftKey="conversation-1" />,
    )

    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
    act(() => {
      fireEvent.change(textarea, { target: { value: 'ship it' } })
    })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('ship it', null)

    first.unmount()

    render(<ChatInput onSend={vi.fn()} draftKey="conversation-1" />)
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe('')
  })
})

// iOS Safari zooms the viewport whenever a focused form control computes to
// under 16px, and this project's `text-sm` is 12px. jsdom has no layout and
// never evaluates the media query, so these assertions pin the class contract
// rather than the rendered size; the visual check belongs in a real browser.
describe('ChatInput mobile zoom guard', () => {
  beforeEach(() => {
    voiceMock.reset()
  })

  it('raises the textarea to the 16px iOS threshold on coarse pointers', () => {
    render(<ChatInput onSend={vi.fn()} />)

    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
    expect(textarea.className).toContain('pointer-coarse:text-[16px]')
  })

  it('keeps the emoji mirror on the same font size as the textarea', () => {
    // The mirror is painted under a transparent caret, so any size drift
    // between the two puts the caret in the wrong place mid-word.
    render(<ChatInput onSend={vi.fn()} />)

    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
    act(() => {
      fireEvent.change(textarea, { target: { value: 'ship it 🚀' } })
    })

    const mirror = Array.from(
      document.querySelectorAll('span[aria-hidden="true"]'),
    ).find((el) => el.textContent === 'ship it 🚀')
    expect(mirror).toBeDefined()
    expect(mirror?.className).toContain('pointer-coarse:text-[16px]')
    // Same line box as the textarea, so the two stay glyph-for-glyph aligned.
    expect(mirror?.className).toContain('leading-6')
  })
})

// `ChatComposer` stacks header actions, the field, and the send footer into
// three rows; on a phone that is ~136px of chrome above the keyboard before a
// word is typed. jsdom has no layout, so these assertions pin the structure —
// one row containing every control — rather than the measured height.
describe('ChatInput mobile single row', () => {
  beforeEach(() => {
    voiceMock.reset()
    setViewportIsMobile(false)
  })

  it('puts the field and every control in one row on phone widths', () => {
    setViewportIsMobile(true)
    render(<ChatInput onSend={vi.fn()} />)

    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
    // The field's own wrapper is a <span>; the nearest <div> is the row.
    const row = textarea.closest('div')

    expect(row).not.toBeNull()
    expect(
      row?.contains(screen.getByRole('button', { name: attachName })),
    ).toBe(true)
    expect(row?.contains(screen.getByRole('button', { name: micName }))).toBe(
      true,
    )
  })

  it('keeps the stacked composer on wider viewports', () => {
    render(<ChatInput onSend={vi.fn()} />)

    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
    const row = textarea.closest('div')

    expect(
      row?.contains(screen.getByRole('button', { name: attachName })),
    ).toBe(false)
    expect(row?.contains(screen.getByRole('button', { name: micName }))).toBe(
      false,
    )
  })

  it('drops the field floor to the control height so the row is 32px', () => {
    // The empty field is what sets the row's height, and a 36px floor next to
    // 32px controls would leave the row taller than anything in it.
    setViewportIsMobile(true)
    render(<ChatInput onSend={vi.fn()} />)

    expect(screen.getByRole('textbox').className).toContain('min-h-8')
  })

  it('still grows with the typed text, up to the five-line cap', () => {
    setViewportIsMobile(true)
    render(<ChatInput onSend={vi.fn()} />)

    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
    expect(textarea.rows).toBe(1)

    // jsdom has no layout, so scrollHeight is always 0; stub it to stand in
    // for the height the typed text would actually occupy.
    let scrollHeight = 72
    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    })

    act(() => {
      fireEvent.change(textarea, { target: { value: 'one\ntwo\nthree' } })
    })
    expect(textarea.style.height).toBe('72px')
    expect(textarea.style.overflowY).toBe('hidden')

    // Past five lines it stops growing and scrolls instead, so a long draft
    // cannot push the transcript off a phone screen.
    scrollHeight = 400
    act(() => {
      fireEvent.change(textarea, { target: { value: 'a\nb\nc\nd\ne\nf\ng' } })
    })
    expect(textarea.style.height).toBe('120px')
    expect(textarea.style.overflowY).toBe('auto')
  })
})
