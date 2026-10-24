import { describe, expect, it } from 'vitest'
import { bundledSkills } from '@renderer/skills'
import { illustrationOf } from './skillIllustration'

describe('illustrationOf', () => {
  it('has a picture for each skill that comes with the app', () => {
    for (const skill of bundledSkills.skills) {
      expect(illustrationOf(skill.id), skill.id).toBeTruthy()
    }
  })

  it('has none for a skill it does not know, such as one the coach made', () => {
    expect(illustrationOf('custom_flute')).toBeNull()
  })
})
