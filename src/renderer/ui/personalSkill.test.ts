import { beforeEach, describe, expect, it, vi } from 'vitest'
import squat from '@renderer/skills/squat.json'
import type { CompletedRep } from '@renderer/engine/repCounter'
import type { CustomSkillSource } from '@shared/customSkills'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import { adjustSkillToPerson } from './personalSkill'
import { mergeSkills, useSkills } from './skillsStore'

const parsed = parseSkillConfig({ ...squat, id: 'custom_squat' })
if (!parsed.ok) throw new Error(parsed.errors.join('; '))
const skill = parsed.skill

// A squat whose deepest point is 108 degrees: the skill asks for 100.
const rep: CompletedRep = {
  index: 1,
  startMs: 0,
  endMs: 1600,
  durationMs: 1600,
  steps: [
    { phase: 'up', timestampMs: 0 },
    { phase: 'down', timestampMs: 800 },
    { phase: 'up', timestampMs: 1600 }
  ],
  samples: [175, 108, 175].map((knee, index) => ({
    timestampMs: index * 800,
    values: { knee, torso: 15 }
  }))
}

beforeEach(() => useSkills.setState(mergeSkills([])))

function fakeApi(saved: boolean): {
  skills: Parameters<typeof adjustSkillToPerson>[0]['skills']
} {
  const stored: CustomSkillSource[] = []
  return {
    skills: {
      saveCalibrated: vi.fn((id: string, config: unknown) => {
        if (saved) stored.splice(0, stored.length, { id, config })
        return Promise.resolve(saved)
      }),
      listCustom: vi.fn(() => Promise.resolve(stored))
    }
  }
}

describe('adjustSkillToPerson', () => {
  it('keeps the adjusted skill and makes the app use it', async () => {
    const api = fakeApi(true)

    expect(await adjustSkillToPerson(api, skill, rep)).toBe('saved')

    const depth = useSkills
      .getState()
      .skills.find((candidate) => candidate.id === 'custom_squat')
      ?.rules.find((rule) => rule.id === 'depth')
    expect(depth?.check).not.toBe('min(knee) <= 100')
  })

  it('says so when nothing needed to change, and saves nothing', async () => {
    const api = fakeApi(true)
    const empty: CompletedRep = { ...rep, samples: [] }

    expect(await adjustSkillToPerson(api, skill, empty)).toBe('unchanged')
    expect(api.skills.saveCalibrated).not.toHaveBeenCalled()
  })

  it('says so when it could not be saved', async () => {
    expect(await adjustSkillToPerson(fakeApi(false), skill, rep)).toBe('failed')
  })
})
