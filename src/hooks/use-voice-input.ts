import { useCallback, useEffect, useRef, useState } from 'react'

const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
    : undefined

export const isVoiceInputSupported = Boolean(SpeechRecognitionCtor)

export type UseVoiceInputOptions = {
  onResult: (text: string) => void
  lang?: string
  onError?: (code: string) => void
}

export function useVoiceInput({
  onResult,
  lang = 'ru-RU',
  onError,
}: UseVoiceInputOptions) {
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const cleanupRecognition = useCallback(() => {
    recognitionRef.current = null
    setIsRecording(false)
    setInterimText('')
  }, [])

  const startRecording = useCallback(() => {
    if (!SpeechRecognitionCtor || recognitionRef.current) return

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }

      if (interim) {
        setInterimText(interim)
      }

      if (final.trim()) {
        onResultRef.current(final.trim())
        setInterimText('')
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      onErrorRef.current?.(event.error)
      cleanupRecognition()
    }

    recognition.onend = () => {
      cleanupRecognition()
    }

    recognitionRef.current = recognition
    setIsRecording(true)
    setInterimText('')

    try {
      recognition.start()
    } catch {
      cleanupRecognition()
      onErrorRef.current?.('start-failed')
    }
  }, [lang, cleanupRecognition])

  const stopRecording = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return

    try {
      recognition.stop()
    } catch {
      cleanupRecognition()
    }
  }, [cleanupRecognition])

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current
      if (!recognition) return

      try {
        recognition.abort()
      } catch {
        // ignore abort errors on unmount
      }
      recognitionRef.current = null
    }
  }, [])

  return {
    isRecording,
    interimText,
    startRecording,
    stopRecording,
    isSupported: isVoiceInputSupported,
  }
}
