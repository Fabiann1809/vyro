import { beforeEach, describe, expect, it } from 'vitest'
import squat from '@renderer/skills/squat.json'
import { setLanguage } from '@renderer/i18n'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import { describeSkill } from './skillPreview'

function skill(): Parameters<typeof describeSkill>[0] {
  const parsed = parseSkillConfig(squat)
  if (!parsed.ok) throw new Error(parsed.errors.join(', '))
  return parsed.skill
}

beforeEach(() => setLanguage('es'))

describe('describeSkill', () => {
  it('says in plain words what the skill measures and corrects', () => {
    const preview = describeSkill(skill())

    expect(preview.name).toBe('Sentadilla')
    expect(preview.camera).toBe('De lado, cuerpo entero')
    expect(preview.metrics[0]).toContain('ángulo de rodilla, entre cadera y tobillo')
    expect(preview.rules.length).toBe(skill().rules.length)
    expect(preview.rules.every((rule) => rule.message.length > 0)).toBe(true)
  })

  it('describes the phases with their conditions', () => {
    const preview = describeSkill(skill())

    expect(preview.phases.some((phase) => phase.includes('mayor que'))).toBe(true)
    expect(preview.repetition).toContain('→')
  })

  it('uses the language of the person', () => {
    setLanguage('en')

    const preview = describeSkill(skill())

    expect(preview.camera).toBe('From the side, full body')
    expect(preview.metrics[0]).toContain('knee')
  })
})
