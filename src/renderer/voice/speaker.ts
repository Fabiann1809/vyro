import type { Language } from '@renderer/i18n'

// The little part of the browser speech API that is used, so it can be replaced in tests.
export interface SpeechBackend {
  getVoices: () => SpeechSynthesisVoice[]
  speak: (utterance: SpeechSynthesisUtterance) => void
  cancel: () => void
  isSpeaking: () => boolean
  createUtterance: (text: string) => SpeechSynthesisUtterance
}

export interface SpeakOptions {
  language: Language
  // 0..1
  volume: number
}

// A voice for the language, preferring the ones installed on the computer (they work offline
// and answer faster) and the one the system marks as its default.
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  language: Language
): SpeechSynthesisVoice | null {
  const matching = voices.filter((voice) => voice.lang.toLowerCase().split(/[-_]/)[0] === language)
  const score = (voice: SpeechSynthesisVoice): number =>
    (voice.localService ? 2 : 0) + (voice.default ? 1 : 0)

  // Array.prototype.sort is stable, so voices with the same score keep the system's order.
  return [...matching].sort((a, b) => score(b) - score(a))[0] ?? null
}

export class Speaker {
  constructor(private readonly backend: SpeechBackend) {}

  // True when the language has a voice on this computer.
  canSpeak(language: Language): boolean {
    return pickVoice(this.backend.getVoices(), language) !== null
  }

  // Says the text in the language, cutting off whatever was being said. Returns false, and says
  // nothing, when there is no voice for the language.
  speak(text: string, options: SpeakOptions): boolean {
    const voice = pickVoice(this.backend.getVoices(), options.language)
    if (!voice) return false

    const utterance = this.backend.createUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.volume = Math.min(1, Math.max(0, options.volume))

    this.backend.cancel()
    this.backend.speak(utterance)
    return true
  }

  isSpeaking(): boolean {
    return this.backend.isSpeaking()
  }

  cancel(): void {
    this.backend.cancel()
  }
}
