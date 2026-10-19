import { describe, expect, it } from 'vitest'
import { isGuitarLesson, mentionsGuitar } from './guitar'

const named = (
  id: string,
  es: string,
  en: string,
  object?: 'guitar'
): { id: string; name: { es: string; en: string }; object?: 'guitar' } => ({
  id,
  name: { es, en },
  ...(object ? { object } : {})
})

describe('guitar skills', () => {
  it('knows a skill is about the guitar by its id, its name or its object', () => {
    expect(mentionsGuitar(named('custom_guitar_open_string', 'Cuerda', 'String'))).toBe(true)
    expect(mentionsGuitar(named('custom_acordes', 'Acordes de guitarra', 'Chords'))).toBe(true)
    expect(mentionsGuitar(named('custom_hold', 'Sujetar', 'Hold', 'guitar'))).toBe(true)
    expect(mentionsGuitar(named('squat', 'Sentadilla', 'Squat'))).toBe(false)
  })

  it('does not call the posture a lesson', () => {
    expect(isGuitarLesson(named('guitar_posture', 'Postura con guitarra', 'Guitar posture'))).toBe(
      false
    )
    expect(isGuitarLesson(named('custom_guitar_chords', 'Acordes', 'Chords'))).toBe(true)
  })
})
