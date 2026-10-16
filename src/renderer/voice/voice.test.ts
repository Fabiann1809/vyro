import { describe, expect, it } from 'vitest'
import { Speaker, type SpeechBackend } from './speaker'
import { Voice, type ClipPlayer } from './voice'

const spanishVoice = { name: 'Sofía', lang: 'es-MX', localService: true, default: true }

function setup(
  voices: unknown[],
  clips: Record<string, string>
): { voice: Voice; spoken: string[]; played: Array<{ url: string; volume: number }> } {
  const spoken: string[] = []
  const backend: SpeechBackend = {
    getVoices: () => voices as SpeechSynthesisVoice[],
    speak: (utterance) => void spoken.push(utterance.text),
    cancel: () => undefined,
    isSpeaking: () => false,
    createUtterance: (text) => ({ text }) as SpeechSynthesisUtterance
  }
  const played: Array<{ url: string; volume: number }> = []
  const player: ClipPlayer = {
    play: (url, volume) => void played.push({ url, volume }),
    stop: () => undefined,
    isPlaying: () => false
  }
  const voice = new Voice(
    new Speaker(backend),
    player,
    (language, id) => clips[`${language}/${id}`] ?? null
  )
  return { voice, spoken, played }
}

const message = { clipId: 'squat.depth', text: 'Baja más la cadera' }
const options = { language: 'es', volume: 0.5 } as const

describe('Voice', () => {
  it('uses the voice of the system when it has one for the language', () => {
    const { voice, spoken, played } = setup([spanishVoice], { 'es/squat.depth': 'clip.wav' })

    expect(voice.say(message, options)).toBe('system-voice')
    expect(spoken).toEqual(['Baja más la cadera'])
    expect(played).toEqual([])
  })

  it('plays the recorded clip when the system has no voice for the language', () => {
    const { voice, spoken, played } = setup([], { 'es/squat.depth': 'clip.wav' })

    expect(voice.say(message, options)).toBe('recorded-clip')
    expect(spoken).toEqual([])
    expect(played).toEqual([{ url: 'clip.wav', volume: 0.5 }])
  })

  it('is silent when there is neither a voice nor a clip', () => {
    const { voice, played } = setup([], {})

    expect(voice.say(message, options)).toBe('silent')
    expect(played).toEqual([])
  })

  it('picks the clip of the language being spoken', () => {
    const { voice, played } = setup([], { 'es/squat.depth': 'es.wav', 'en/squat.depth': 'en.wav' })

    voice.say(message, { language: 'en', volume: 1 })

    expect(played[0]?.url).toBe('en.wav')
  })
})
