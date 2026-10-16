import { clipUrl } from './clips'
import { Speaker } from './speaker'
import { Voice, type ClipPlayer } from './voice'

const speaker = new Speaker({
  getVoices: () => window.speechSynthesis.getVoices(),
  speak: (utterance) => window.speechSynthesis.speak(utterance),
  cancel: () => window.speechSynthesis.cancel(),
  createUtterance: (text) => new SpeechSynthesisUtterance(text)
})

const audio = new Audio()
const player: ClipPlayer = {
  play: (url, volume) => {
    audio.src = url
    audio.volume = volume
    audio.play().catch(() => undefined)
  },
  stop: () => audio.pause()
}

// The app's voice: the speech engine of the operating system, with recorded clips as backup.
export const voice = new Voice(speaker, player, clipUrl)
