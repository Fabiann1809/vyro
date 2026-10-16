import { Speaker } from './speaker'

// The app's voice, backed by the speech engine of the operating system.
export const speaker = new Speaker({
  getVoices: () => window.speechSynthesis.getVoices(),
  speak: (utterance) => window.speechSynthesis.speak(utterance),
  cancel: () => window.speechSynthesis.cancel(),
  createUtterance: (text) => new SpeechSynthesisUtterance(text)
})
