import { describe, expect, it } from 'vitest'
import { skillConfigSchema } from '@shared/skill/skillSchema'
import { validSkillInput } from '@shared/skill/skillFixtures'
import { retarget } from './retarget'

const tuning = skillConfigSchema.parse({
  ...validSkillInput,
  metrics: { cents: { type: 'pitch', target: 'nearest' }, level: { type: 'level' } },
  phases: [
    { id: 'quiet', when: { level: { lt: -42 } } },
    { id: 'ringing', when: { level: { gt: -32 } } }
  ],
  rep: { sequence: ['quiet', 'ringing', 'quiet'], minDurationMs: 200 },
  rules: [
    {
      id: 'too_flat',
      severity: 'high',
      check: 'avg(cents) >= -10',
      message: { es: 'Baja', en: 'Flat' }
    }
  ]
})

describe('retarget', () => {
  it('aims every pitch metric at the note and leaves the rest as it was', () => {
    const aimed = retarget(tuning, 'D3')

    expect(aimed.metrics.cents).toEqual({ type: 'pitch', target: 'D3' })
    expect(aimed.metrics.level).toEqual({ type: 'level' })
    expect(aimed.rules).toBe(tuning.rules)
  })

  it('does not change the skill it was given', () => {
    retarget(tuning, 'D3')

    expect(tuning.metrics.cents).toEqual({ type: 'pitch', target: 'nearest' })
  })
})
