import { m } from '@/paraglide/messages'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as HeroUI from '@heroui/react'
import { ChatInput } from './chat-input'

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

vi.mock('@heroui/react', async () => {
  const actual = await vi.importActual<typeof HeroUI>('@heroui/react')
  return {
    ...actual,
    toast: {
      danger: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
    },
  }
})

const micName = m.inbox_composer_voice_label()
const sendName = m.inbox_composer_send_label()

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
})
