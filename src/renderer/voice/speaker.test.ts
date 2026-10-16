import { describe, expect, it } from 'vitest'
import { pickVoice, Speaker, type SpeechBackend } from './speaker'

const voice = (
  name: string,
  lang: string,
  extra: Partial<SpeechSynthesisVoice> = {}
): SpeechSynthesisVoice =>
  ({
    name,
    lang,
    localService: false,
    default: false,
    voiceURI: name,
    ...extra
  }) as SpeechSynthesisVoice

function fakeBackend(
  voices: SpeechSynthesisVoice[]
): SpeechBackend & { spoken: string[]; cancels: number } {
  const backend = {
    spoken: [] as string[],
    cancels: 0,
    getVoices: () => voices,
    speak: (utterance: SpeechSynthesisUtterance) => void backend.spoken.push(utterance.text),
    cancel: () => void backend.cancels++,
    createUtterance: (text: string) => ({ text }) as SpeechSynthesisUtterance
  }
  return backend
}

describe('pickVoice', () => {
  it('finds a voice for the language whatever the region', () => {
    const voices = [voice('Ana', 'en-US'), voice('Sofía', 'es-MX')]

    expect(pickVoice(voices, 'es')?.name).toBe('Sofía')
    expect(pickVoice(voices, 'en')?.name).toBe('Ana')
  })

  it('returns null when the language has no voice', () => {
    expect(pickVoice([voice('Ana', 'en-US')], 'es')).toBeNull()
    expect(pickVoice([], 'es')).toBeNull()
  })

  it('prefers a voice installed on the computer', () => {
    const voices = [voice('Online', 'es-ES'), voice('Local', 'es-CO', { localService: true })]

    expect(pickVoice(voices, 'es')?.name).toBe('Local')
  })

  it('prefers the default voice among equals, then keeps the system order', () => {
    const voices = [
      voice('A', 'es-ES'),
      voice('B', 'es-ES', { default: true }),
      voice('C', 'es-ES')
    ]

    expect(pickVoice(voices, 'es')?.name).toBe('B')
    expect(pickVoice([voice('A', 'es-ES'), voice('C', 'es-ES')], 'es')?.name).toBe('A')
  })

  it('does not mistake another language that starts with the same letters', () => {
    expect(pickVoice([voice('Eesti', 'et-EE'), voice('Esperanto', 'eo')], 'es')).toBeNull()
  })
})

describe('Speaker', () => {
  it('speaks the text with a voice of the language and the chosen volume', () => {
    const backend = fakeBackend([voice('Sofía', 'es-MX')])
    const spoke = new Speaker(backend).speak('Hola', { language: 'es', volume: 0.5 })

    expect(spoke).toBe(true)
    expect(backend.spoken).toEqual(['Hola'])
  })

  it('stays silent and says so when there is no voice for the language', () => {
    const backend = fakeBackend([voice('Ana', 'en-US')])
    const speaker = new Speaker(backend)

    expect(speaker.canSpeak('es')).toBe(false)
    expect(speaker.speak('Hola', { language: 'es', volume: 1 })).toBe(false)
    expect(backend.spoken).toEqual([])
  })

  it('cuts off what was being said before speaking again', () => {
    const backend = fakeBackend([voice('Sofía', 'es-MX')])
    const speaker = new Speaker(backend)
    speaker.speak('Uno', { language: 'es', volume: 1 })
    speaker.speak('Dos', { language: 'es', volume: 1 })

    expect(backend.cancels).toBe(2)
  })

  it('keeps the volume between 0 and 1', () => {
    const utterances: SpeechSynthesisUtterance[] = []
    const backend = {
      ...fakeBackend([voice('Sofía', 'es-MX')]),
      speak: (utterance: SpeechSynthesisUtterance) => void utterances.push(utterance)
    }

    new Speaker(backend).speak('Hola', { language: 'es', volume: 3 })

    expect(utterances[0]?.volume).toBe(1)
  })
})
