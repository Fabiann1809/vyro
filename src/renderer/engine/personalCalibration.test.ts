import { describe, expect, it } from 'vitest'
import squat from '@renderer/skills/squat.json'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'
import { personalizeSkill } from './personalCalibration'
import type { CompletedRep } from './repCounter'
import { RepEvaluator } from './repEvaluator'

function load(raw: unknown): SkillConfig {
  const parsed = parseSkillConfig(raw)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
}

const skill = load(squat)

// A squat sampled every 100 ms: `bottom` is the deepest knee angle, `torso` the lean, and
// `descentMs` how long the way down takes. The way up takes as long.
function squatRep(options: { bottom: number; torso?: number; descentMs?: number }): CompletedRep {
  const { bottom, torso = 15, descentMs = 800 } = options
  const durationMs = descentMs * 2
  const frames = durationMs / 100
  const samples = Array.from({ length: frames + 1 }, (_, index) => {
    const t = index / frames
    const knee = 175 - (175 - bottom) * Math.sin(Math.PI * t)
    return { timestampMs: 1000 + index * 100, values: { knee, torso } }
  })
  return {
    index: 1,
    startMs: 1000,
    endMs: 1000 + durationMs,
    durationMs,
    steps: [
      { phase: 'up', timestampMs: 1000 },
      { phase: 'down', timestampMs: 1000 + descentMs },
      { phase: 'up', timestampMs: 1000 + durationMs }
    ],
    samples
  }
}

const qualityOf = (calibrated: SkillConfig, rep: CompletedRep): string =>
  new RepEvaluator(calibrated).evaluate(rep).quality

describe('personalizeSkill', () => {
  it('accepts the repetition it was calibrated with', () => {
    const good = squatRep({ bottom: 95 })

    const { skill: personal } = personalizeSkill(skill, good)

    expect(qualityOf(personal, good)).toBe('good')
  })

  it('rejects a repetition that is clearly worse than the good one', () => {
    const { skill: personal } = personalizeSkill(skill, squatRep({ bottom: 95 }))

    // Shallow, and with the chest leaning far forward.
    expect(qualityOf(personal, squatRep({ bottom: 135 }))).toBe('bad')
    expect(qualityOf(personal, squatRep({ bottom: 95, torso: 70 }))).not.toBe('good')
  })

  it('fits the thresholds to the person: a squat that is a bit less deep becomes the good one', () => {
    // The skill asks for 100 degrees; this person's good squat reaches 108.
    const theirs = squatRep({ bottom: 108 })
    expect(qualityOf(skill, theirs)).toBe('bad')

    const { skill: personal, changes } = personalizeSkill(skill, theirs)

    expect(qualityOf(personal, theirs)).toBe('good')
    expect(changes.find((change) => change.ruleId === 'depth')).toMatchObject({ from: 100 })
  })

  it('says which thresholds moved, and leaves the rest of the skill as it was', () => {
    const { skill: personal, changes } = personalizeSkill(skill, squatRep({ bottom: 90 }))

    expect(changes.map((change) => change.ruleId)).toContain('depth')
    expect(personal.phases).toEqual(skill.phases)
    expect(personal.metrics).toEqual(skill.metrics)
    expect(personal.rules.map((rule) => rule.id)).toEqual(skill.rules.map((rule) => rule.id))
    expect(personal.rules.map((rule) => rule.message)).toEqual(
      skill.rules.map((rule) => rule.message)
    )
  })

  it('adjusts the times too: a slower descent is allowed to be that slow', () => {
    // "descentMs >= 500": a quick, good squat of 420 ms down.
    const quick = squatRep({ bottom: 95, descentMs: 420 })

    const { skill: personal } = personalizeSkill(skill, quick)

    expect(qualityOf(personal, quick)).toBe('good')
  })

  it('does not take a threshold too far from what was written', () => {
    // A "good" squat that reaches only 160 degrees would turn a depth of 100 into nonsense.
    const { skill: personal, changes } = personalizeSkill(skill, squatRep({ bottom: 160 }))

    expect(changes.find((change) => change.ruleId === 'depth')).toBeUndefined()
    expect(personal.rules.find((rule) => rule.id === 'depth')?.check).toBe('min(knee) <= 100')
  })

  it('leaves alone a rule that is not a plain comparison with a number', () => {
    const odd = load({
      ...squat,
      rules: [
        {
          id: 'depth',
          severity: 'high',
          check: 'min(knee) <= 100 + 5 && range(torso) < 2 * 10',
          message: { es: 'a', en: 'a' }
        }
      ]
    })

    const { skill: personal, changes } = personalizeSkill(odd, squatRep({ bottom: 90 }))

    expect(changes).toEqual([])
    expect(personal.rules[0]?.check).toBe(odd.rules[0]?.check)
  })

  it('changes nothing when the repetition has no data for a metric', () => {
    const empty: CompletedRep = { ...squatRep({ bottom: 95 }), samples: [] }

    expect(personalizeSkill(skill, empty).changes).toEqual([])
  })

  it('does not touch the skill it was given', () => {
    const before = JSON.stringify(skill)

    personalizeSkill(skill, squatRep({ bottom: 108 }))

    expect(JSON.stringify(skill)).toBe(before)
  })
})
