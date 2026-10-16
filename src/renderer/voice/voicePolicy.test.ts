import { afterEach, describe, expect, it } from 'vitest'
import type { FeedbackMessage } from '@renderer/engine/feedback'
import { setLanguage } from '@renderer/i18n'
import type { SayOptions, SpokenMessage } from './voice'
import { VoicePolicy, type Talker, type VoiceSettings } from './voicePolicy'

const settings: VoiceSettings = { enabled: true, language: 'es', volume: 0.8 }

afterEach(() => setLanguage('es'))

const correction = (
  ruleId: string,
  severity: 'high' | 'medium' | 'low',
  live = false
): FeedbackMessage => ({
  kind: 'correction',
  ruleId,
  severity,
  message: { es: `corrige ${ruleId}`, en: `fix ${ruleId}` },
  live
})

function setup(): {
  policy: VoicePolicy
  said: Array<{ message: SpokenMessage; options: SayOptions }>
  speaking: { now: boolean }
} {
  const said: Array<{ message: SpokenMessage; options: SayOptions }> = []
  const speaking = { now: false }
  const talker: Talker = {
    say: (message, options) => {
      said.push({ message, options })
      return 'system-voice'
    },
    isSpeaking: () => speaking.now
  }
  return { policy: new VoicePolicy(talker, 'squat', { repeatMs: 20_000 }), said, speaking }
}

describe('VoicePolicy', () => {
  it('speaks an important correction with the clip of its rule', () => {
    const { policy, said } = setup()

    expect(policy.consider(correction('depth', 'high'), settings, 0)).toBe(true)
    expect(said[0]?.message).toEqual({ clipId: 'squat.depth', text: 'corrige depth' })
    expect(said[0]?.options).toEqual(settings)
  })

  it('speaks a praise', () => {
    const { policy, said } = setup()

    expect(policy.consider({ kind: 'praise', variant: 1 }, settings, 0)).toBe(true)
    expect(said[0]?.message).toEqual({ clipId: 'praise.1', text: '¡Buena técnica!' })
  })

  it('leaves small details on the screen', () => {
    const { policy, said } = setup()

    expect(policy.consider(correction('descent_control', 'low'), settings, 0)).toBe(false)
    expect(said).toEqual([])
  })

  it('is silent when the voice is off', () => {
    const { policy, said } = setup()
    const off = { ...settings, enabled: false }

    expect(policy.consider(correction('depth', 'high'), off, 0)).toBe(false)
    expect(said).toEqual([])
  })

  it('does not repeat a message too soon, but does after a while', () => {
    const { policy } = setup()

    expect(policy.consider(correction('depth', 'high'), settings, 0)).toBe(true)
    expect(policy.consider(correction('depth', 'high'), settings, 10_000)).toBe(false)
    expect(policy.consider(correction('depth', 'high'), settings, 20_000)).toBe(true)
  })

  it('does not block a different message with the repetition rule', () => {
    const { policy } = setup()

    policy.consider(correction('depth', 'high'), settings, 0)

    expect(policy.consider(correction('torso_lean', 'medium'), settings, 1000)).toBe(true)
  })

  it('does not talk over the voice that is still speaking', () => {
    const { policy, said, speaking } = setup()
    speaking.now = true

    expect(policy.consider(correction('depth', 'high'), settings, 0)).toBe(false)
    expect(said).toEqual([])
  })

  it('may interrupt only for an urgent alert about the movement in progress', () => {
    const { policy, speaking } = setup()
    speaking.now = true

    expect(policy.consider(correction('torso_lean', 'medium', true), settings, 0)).toBe(false)
    expect(policy.consider(correction('depth', 'high', true), settings, 0)).toBe(true)
  })

  it('does not count as spoken what nobody could hear', () => {
    const talker: Talker = { say: () => 'silent', isSpeaking: () => false }
    const policy = new VoicePolicy(talker, 'squat')

    expect(policy.consider(correction('depth', 'high'), settings, 0)).toBe(false)
  })

  it('speaks with the text of the current language', () => {
    const { policy, said } = setup()
    setLanguage('en')

    policy.consider(correction('depth', 'high'), { ...settings, language: 'en' }, 0)

    expect(said[0]?.message.text).toBe('fix depth')
  })
})
