import type { Language } from '@renderer/i18n'
import type { Speaker } from './speaker'

export interface SpokenMessage {
  // Names the recorded clip to play when the computer has no voice for the language.
  clipId: string
  text: string
}

export interface SayOptions {
  language: Language
  // 0..1
  volume: number
}

// What a clip player must do; the browser's audio element does it in the app.
export interface ClipPlayer {
  play: (url: string, volume: number) => void
  stop: () => void
  isPlaying: () => boolean
}

export type HowItSounded = 'system-voice' | 'recorded-clip' | 'silent'

// Speaks a message with the voice of the computer and, when it has none for the language, plays
// the recorded clip, so the user hears the same things on any system.
export class Voice {
  constructor(
    private readonly speaker: Speaker,
    private readonly player: ClipPlayer,
    private readonly findClip: (language: Language, id: string) => string | null
  ) {}

  say(message: SpokenMessage, options: SayOptions): HowItSounded {
    if (this.speaker.speak(message.text, options)) return 'system-voice'

    const url = this.findClip(options.language, message.clipId)
    if (!url) return 'silent'

    this.player.stop()
    this.player.play(url, Math.min(1, Math.max(0, options.volume)))
    return 'recorded-clip'
  }

  // True while the voice or a clip is still talking.
  isSpeaking(): boolean {
    return this.speaker.isSpeaking() || this.player.isPlaying()
  }

  stop(): void {
    this.speaker.cancel()
    this.player.stop()
  }
}
