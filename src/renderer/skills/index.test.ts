import { describe, expect, it } from 'vitest'
import { bundledSkills } from './index'

describe('bundled skills', () => {
  it('loads the three exercises of the MVP without errors', () => {
    expect(bundledSkills.errors).toEqual([])
    expect(bundledSkills.skills.map((skill) => skill.id)).toEqual(['bicep_curl', 'pushup', 'squat'])
  })
})
