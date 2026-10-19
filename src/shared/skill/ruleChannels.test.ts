import { describe, expect, it } from 'vitest'
import { fourChannelSkill } from './skillFixtures'
import { loadSkills } from './skillLoader'
import { ruleChannel } from './ruleChannels'
import { skillChannels } from './skillChannels'

const sources = import.meta.glob('../../renderer/skills/*.json', { eager: true, import: 'default' })
const { skills } = loadSkills(sources)

const skill = (id: string): (typeof skills)[number] => {
  const found = skills.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`no skill ${id}`)
  return found
}

describe('ruleChannel', () => {
  it('gives each rule of a skill with four channels the channel of what it checks', () => {
    const guitar = fourChannelSkill

    expect(ruleChannel(guitar, 'straight_back')).toBe('body')
    expect(ruleChannel(guitar, 'guitar_across')).toBe('object')
    expect(ruleChannel(guitar, 'guitar_height')).toBe('object')
    expect(ruleChannel(guitar, 'fretting_wrist')).toBe('hands')
    expect(ruleChannel(guitar, 'out_of_tune')).toBe('audio')
  })

  it('knows the channel of the rules of a skill that only uses the body', () => {
    const squat = skill('squat')

    for (const rule of squat.rules) expect(ruleChannel(squat, rule.id)).toBe('body')
  })

  it('falls back to what the skill mostly looks at for a rule it does not know', () => {
    expect(ruleChannel(skill('string_tuning'), 'no_such_rule')).toBe('audio')
  })

  it('always answers with a channel the skill uses', () => {
    for (const each of skills) {
      for (const rule of each.rules) {
        const channels = skillChannels(each)
        expect(channels, `${each.id}.${rule.id}`).toContain(ruleChannel(each, rule.id))
      }
    }
  })
})
