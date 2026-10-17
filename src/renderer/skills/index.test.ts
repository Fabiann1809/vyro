import { describe, expect, it } from 'vitest'
import { bundledSkills } from './index'

describe('bundled skills', () => {
  it('loads the exercises that come with the app without errors', () => {
    expect(bundledSkills.errors).toEqual([])
    expect(bundledSkills.skills.map((skill) => skill.id)).toEqual([
      'bicep_curl',
      'piano_hand',
      'pushup',
      'squat'
    ])
  })
})
