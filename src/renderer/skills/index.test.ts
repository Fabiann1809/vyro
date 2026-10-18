import { describe, expect, it } from 'vitest'
import { bundledSkills } from './index'

describe('bundled skills', () => {
  it('loads the exercises that come with the app without errors', () => {
    expect(bundledSkills.errors).toEqual([])
    expect(bundledSkills.skills.map((skill) => skill.id)).toEqual([
      'bicep_curl',
      'guitar_posture',
      'piano_hand',
      'piano_note',
      'pushup',
      'squat',
      'steady_beat',
      'string_tuning'
    ])
  })

  it('gives every exercise a guide, with what the app does not check, in both languages', () => {
    for (const skill of bundledSkills.skills) {
      expect(skill.guide, skill.id).toBeDefined()
      expect(skill.guide?.tips.length, skill.id).toBeGreaterThanOrEqual(3)
      expect(skill.guide?.notMeasured.length, skill.id).toBeGreaterThanOrEqual(2)
      for (const line of [...(skill.guide?.tips ?? []), ...(skill.guide?.notMeasured ?? [])]) {
        expect(line.es, skill.id).not.toBe(line.en)
      }
    }
  })
})
