import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const speechMocks = vi.hoisted(() => {
  type RecognitionHandler = ((event: SpeechRecognitionEvent) => void) | null
  type ErrorHandler = ((event: SpeechRecognitionErrorEvent) => void) | null
  type EndHandler = (() => void) | null

  class MockSpeechRecognition {
    lang = ''
    continuous = false
    interimResults = false
    onresult: RecognitionHandler = null
    onerror: ErrorHandler = null
    onend: EndHandler = null

    start = vi.fn(() => {
      // no-op; tests drive events manually
    })

    stop = vi.fn(() => {
      this.onend?.()
    })

    abort = vi.fn(() => {
      this.onend?.()
    })

    emitInterim(transcript: string) {
      this.onresult?.({
        resultIndex: 0,
        results: [
          {
            isFinal: false,
            length: 1,
            0: { transcript, confidence: 0.9 },
            item: () => ({ transcript, confidence: 0.9 }),
          },
        ],
      } as unknown as SpeechRecognitionEvent)
    }

    emitFinal(transcript: string) {
      this.onresult?.({
        resultIndex: 0,
        results: [
          {
            isFinal: true,
            length: 1,
            0: { transcript, confidence: 0.95 },
            item: () => ({ transcript, confidence: 0.95 }),
          },
        ],
      } as unknown as SpeechRecognitionEvent)
    }

    emitError(error: string) {
      this.onerror?.({ error, message: error } as SpeechRecognitionErrorEvent)
    }
  }

  let lastInstance: MockSpeechRecognition | null = null

  function MockCtor() {
    lastInstance = new MockSpeechRecognition()
    return lastInstance
  }

  const mockCtorImpl = vi.fn(MockCtor)
  const MockSpeechRecognitionCtor =
    mockCtorImpl as unknown as typeof SpeechRecognition

  Object.defineProperty(window, 'webkitSpeechRecognition', {
    configurable: true,
    writable: true,
    value: MockSpeechRecognitionCtor,
  })
  Object.defineProperty(window, 'SpeechRecognition', {
    configurable: true,
    writable: true,
    value: undefined,
  })

  return {
    mockCtorImpl,
    MockCtor: MockSpeechRecognitionCtor,
    getLastInstance: () => lastInstance,
    clearLastInstance: () => {
      lastInstance = null
    },
  }
})

const { mockCtorImpl, MockCtor, getLastInstance, clearLastInstance } =
  speechMocks

const { useVoiceInput, isVoiceInputSupported } = await import('./use-voice-input')

describe('useVoiceInput', () => {
  beforeEach(() => {
    clearLastInstance()
    mockCtorImpl.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('reports supported when webkitSpeechRecognition exists', () => {
    expect(isVoiceInputSupported).toBe(true)
  })

  it('starts recording and exposes interim text', () => {
    const onResult = vi.fn()

    const { result } = renderHook(() =>
      useVoiceInput({ onResult, lang: 'ru-RU' }),
    )

    act(() => {
      result.current.startRecording()
    })

    const instance = getLastInstance()

    expect(result.current.isRecording).toBe(true)
    expect(mockCtorImpl).toHaveBeenCalledOnce()
    expect(instance?.lang).toBe('ru-RU')
    expect(instance?.continuous).toBe(false)
    expect(instance?.interimResults).toBe(true)

    act(() => {
      instance?.emitInterim('привет')
    })

    expect(result.current.interimText).toBe('привет')
    expect(onResult).not.toHaveBeenCalled()
  })

  it('calls onResult with final transcript and clears interim on stop', async () => {
    const onResult = vi.fn()

    const { result } = renderHook(() => useVoiceInput({ onResult }))

    act(() => {
      result.current.startRecording()
    })

    act(() => {
      getLastInstance()?.emitFinal('  мир  ')
    })

    expect(onResult).toHaveBeenCalledWith('мир')
    expect(result.current.interimText).toBe('')

    act(() => {
      result.current.stopRecording()
    })

    await waitFor(() => {
      expect(result.current.isRecording).toBe(false)
    })
  })

  it('invokes onError and resets state on recognition error', () => {
    const onError = vi.fn()

    const { result } = renderHook(() =>
      useVoiceInput({ onResult: vi.fn(), onError }),
    )

    act(() => {
      result.current.startRecording()
    })

    const instance = getLastInstance()

    act(() => {
      instance?.emitInterim('частично')
    })

    act(() => {
      instance?.emitError('not-allowed')
    })

    expect(onError).toHaveBeenCalledWith('not-allowed')
    expect(result.current.isRecording).toBe(false)
    expect(result.current.interimText).toBe('')
  })

  it('ignores duplicate start while recording', () => {
    const { result } = renderHook(() =>
      useVoiceInput({ onResult: vi.fn() }),
    )

    act(() => {
      result.current.startRecording()
    })

    act(() => {
      result.current.startRecording()
    })

    expect(mockCtorImpl).toHaveBeenCalledOnce()
  })
})

describe('useVoiceInput unsupported', () => {
  it('isSupported is false without SpeechRecognition ctor', async () => {
    vi.resetModules()
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      writable: true,
      value: undefined,
    })

    const mod = await import('./use-voice-input')
    expect(mod.isVoiceInputSupported).toBe(false)

    const onResult = vi.fn()
    const { result } = renderHook(() => mod.useVoiceInput({ onResult }))

    act(() => {
      result.current.startRecording()
    })

    expect(onResult).not.toHaveBeenCalled()
    expect(result.current.isRecording).toBe(false)

    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      writable: true,
      value: MockCtor,
    })
    vi.resetModules()
  })
})
