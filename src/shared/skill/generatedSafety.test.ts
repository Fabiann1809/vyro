import { describe, expect, it } from 'vitest'
import { generatedSkillProblems, isGeneratedSkillId } from './generatedSafety'
import { parseSkillConfig } from './skillLoader'
import type { SkillConfig } from './skillSchema'

const base = {
  id: 'custom_squat',
  category: 'exercise',
  name: { es: 'Sentadilla', en: 'Squat' },
  camera: { view: 'side', fullBody: true },
  metrics: { knee: { type: 'angle', points: ['hip', 'knee', 'ankle'] } },
  phases: [
    { id: 'up', when: { knee: { gt: 160 } } },
    { id: 'down', when: { knee: { lt: 110 } } }
  ],
  rep: { sequence: ['up', 'down', 'up'], minDurationMs: 800 },
  rules: [
    { id: 'depth', severity: 'high', check: 'min(knee) <= 100', message: { es: 'a', en: 'a' } }
  ]
}

function skill(changes: Record<string, unknown> = {}): SkillConfig {
  const parsed = parseSkillConfig({ ...base, ...changes })
  if (!parsed.ok) throw new Error(parsed.errors.join(', '))
  return parsed.skill
}

describe('generatedSkillProblems', () => {
  it('accepts a reasonable skill', () => {
    expect(generatedSkillProblems(skill())).toEqual([])
  })

  it('rejects an id without the custom_ prefix', () => {
    expect(generatedSkillProblems(skill({ id: 'squat' }))).toEqual([
      'id: "squat" must start with "custom_"'
    ])
  })

  it('rejects a skill without a rule of high severity', () => {
    const rules = [{ ...base.rules[0], severity: 'medium' }]
    expect(generatedSkillProblems(skill({ rules }))[0]).toContain('severity "high"')
  })

  it('rejects an angle threshold outside 0 to 180 degrees', () => {
    const phases = [
      { id: 'up', when: { knee: { gt: 400 } } },
      { id: 'down', when: { knee: { lt: 110 } } }
    ]
    expect(generatedSkillProblems(skill({ phases }))).toEqual([
      'phases.0.when.knee: 400 is outside what "knee" can measure (0 to 180)'
    ])
  })

  it('rejects a phase that can never happen', () => {
    const phases = [
      { id: 'up', when: { knee: { gt: 150, lt: 100 } } },
      { id: 'down', when: { knee: { lt: 110 } } }
    ]
    expect(generatedSkillProblems(skill({ phases }))[0]).toContain('can never happen')
  })

  it('rejects a repetition that is too fast or too slow', () => {
    for (const minDurationMs of [50, 60_000]) {
      const rep = { ...base.rep, minDurationMs }
      expect(generatedSkillProblems(skill({ rep }))[0]).toContain('rep.minDurationMs')
    }
  })

  it('knows which ids are generated', () => {
    expect(isGeneratedSkillId('custom_yoga')).toBe(true)
    expect(isGeneratedSkillId('squat')).toBe(false)
  })
})
