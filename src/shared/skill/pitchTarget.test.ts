import { describe, expect, it } from 'vitest'
import { skillTargetNote } from './pitchTarget'

describe('skillTargetNote', () => {
  it('is the note the pitch metric aims at', () => {
    const metrics = { level: { type: 'level' }, cents: { type: 'pitch', target: 'C4' } } as const

    expect(skillTargetNote({ metrics })).toBe('C4')
  })

  it('is null when the pitch is measured from the nearest note', () => {
    expect(skillTargetNote({ metrics: { cents: { type: 'pitch', target: 'nearest' } } })).toBeNull()
  })

  it('is null when the skill hears no pitch', () => {
    expect(skillTargetNote({ metrics: { level: { type: 'level' } } })).toBeNull()
  })
})
