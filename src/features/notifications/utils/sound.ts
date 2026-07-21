/**
 * Dependency-free notification sound via the Web Audio API — no bundled asset,
 * no third-party library. A short two-tone "ding" that respects browser
 * autoplay policy (the context is resumed on the first user gesture) and is
 * throttled so message bursts don't overlap into noise.
 */

let audioContext: AudioContext | null = null
let lastPlayedAt = 0
const MIN_INTERVAL_MS = 1500

type AudioContextCtor = typeof AudioContext

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const globalWindow = window as unknown as {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  return globalWindow.AudioContext ?? globalWindow.webkitAudioContext ?? null
}

function getContext(): AudioContext | null {
  const Ctor = getAudioContextCtor()
  if (!Ctor) return null
  if (!audioContext) {
    try {
      audioContext = new Ctor()
    } catch {
      return null
    }
  }
  return audioContext
}

/** Resume the audio context on the first user gesture (autoplay policy). */
export function primeNotificationSound(): void {
  if (typeof window === 'undefined') return
  const resume = () => {
    const ctx = getContext()
    void ctx?.resume().catch(() => {})
    window.removeEventListener('pointerdown', resume)
    window.removeEventListener('keydown', resume)
  }
  window.addEventListener('pointerdown', resume, { once: true })
  window.addEventListener('keydown', resume, { once: true })
}

export function playNotificationSound(): void {
  const ctx = getContext()
  if (!ctx) return
  const now = Date.now()
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return
  lastPlayedAt = now
  void ctx.resume().catch(() => {})
  try {
    const start = ctx.currentTime
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, start)
    oscillator.frequency.exponentialRampToValueAtTime(660, start + 0.12)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.32)
  } catch {
    // Ignore audio failures — sound is best-effort.
  }
}
