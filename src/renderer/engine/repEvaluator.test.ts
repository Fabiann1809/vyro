import { describe, expect, it } from 'vitest'
import type { CompletedRep } from './repCounter'
import { buildContext, RepEvaluator } from './repEvaluator'
import { parseSkillConfig } from './skillLoader'
import { validSkillInput } from './skillFixtures'
import type { SkillConfig } from './skillSchema'

function skillWithRules(rules: Array<Record<string, unknown>>): SkillConfig {
  const parsed = parseSkillConfig({ ...validSkillInput, rules })
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
}

function rule(
  id: string,
  check: string,
  severity: 'high' | 'medium' | 'low' = 'high',
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return { id, severity, check, message: { es: `Mensaje ${id}`, en: `Message ${id}` }, ...extra }
}

// A repetition of 30 fps frames. `knee` and `torso` are the values of each frame (null = not
// measurable). The steps follow up → down → up, with the bottom reached at `bottomAtMs`.
function makeRep(
  options: {
    knee?: Array<number | null>
    torso?: Array<number | null>
    durationMs?: number
    bottomAtMs?: number
    index?: number
  } = {}
): CompletedRep {
  const knee = options.knee ?? [170, 130, 90, 130, 170]
  const torso = options.torso ?? knee.map(() => 10)
  const durationMs = options.durationMs ?? 1500
  const bottomAtMs = options.bottomAtMs ?? 700

  return {
    index: options.index ?? 1,
    startMs: 1000,
    endMs: 1000 + durationMs,
    durationMs,
    steps: [
      { phase: 'up', timestampMs: 1000 },
      { phase: 'down', timestampMs: 1000 + bottomAtMs },
      { phase: 'up', timestampMs: 1000 + durationMs }
    ],
    samples: knee.map((value, index) => ({
      timestampMs: 1000 + (index * durationMs) / Math.max(knee.length - 1, 1),
      values: { knee: value, torso: torso[index] ?? null, kneeDrift: 0 }
    }))
  }
}

describe('buildContext', () => {
  const names = ['knee', 'torso', 'kneeDrift']

  it('builds one series per metric from the frames of the repetition', () => {
    const context = buildContext(makeRep({ knee: [170, 120, 90], torso: [5, 15, 25] }), names)

    expect(context.series.knee).toEqual([170, 120, 90])
    expect(context.series.torso).toEqual([5, 15, 25])
  })

  it('leaves out the frames where a metric could not be measured', () => {
    const context = buildContext(makeRep({ knee: [170, null, 90, null] }), names)

    expect(context.series.knee).toEqual([170, 90])
  })

  it('gives an empty series for a metric that was never measured', () => {
    const context = buildContext(makeRep({ knee: [null, null] }), names)

    expect(context.series.knee).toEqual([])
  })

  it('measures descent and ascent around the middle step of the sequence', () => {
    const context = buildContext(makeRep({ durationMs: 1500, bottomAtMs: 700 }), names)

    expect(context.scalars).toEqual({ durationMs: 1500, descentMs: 700, ascentMs: 800 })
  })

  it('takes the middle step as the turning point in a longer sequence', () => {
    const rep: CompletedRep = {
      ...makeRep({ durationMs: 2000 }),
      steps: [
        { phase: 'up', timestampMs: 1000 },
        { phase: 'mid', timestampMs: 1400 },
        { phase: 'down', timestampMs: 1900 },
        { phase: 'mid', timestampMs: 2500 },
        { phase: 'up', timestampMs: 3000 }
      ]
    }

    const context = buildContext(rep, names)

    expect(context.scalars.descentMs).toBe(900)
    expect(context.scalars.ascentMs).toBe(1100)
  })
})

describe('RepEvaluator', () => {
  it('marks a repetition as good when every rule passes', () => {
    const evaluator = new RepEvaluator(skillWithRules([rule('depth', 'min(knee) <= 100')]))

    const result = evaluator.evaluate(makeRep({ knee: [170, 120, 90, 170] }))

    expect(result.quality).toBe('good')
    expect(result.failed).toEqual([])
    expect(result.outcomes).toEqual([
      expect.objectContaining({ ruleId: 'depth', status: 'passed' })
    ])
  })

  it('marks a repetition as bad when a high severity rule fails', () => {
    const evaluator = new RepEvaluator(skillWithRules([rule('depth', 'min(knee) <= 100')]))

    const result = evaluator.evaluate(makeRep({ knee: [170, 130, 115, 170] }))

    expect(result.quality).toBe('bad')
    expect(result.failed).toEqual([
      {
        ruleId: 'depth',
        severity: 'high',
        status: 'failed',
        message: { es: 'Mensaje depth', en: 'Message depth' }
      }
    ])
  })

  it('marks a repetition as needing work when only lesser rules fail', () => {
    const evaluator = new RepEvaluator(
      skillWithRules([
        rule('depth', 'min(knee) <= 100', 'high'),
        rule('torso', 'max(torso) <= 45', 'medium'),
        rule('tempo', 'descentMs >= 800', 'low')
      ])
    )

    const medium = evaluator.evaluate(makeRep({ torso: [10, 30, 60, 30, 10] }))
    const low = evaluator.evaluate(makeRep({ bottomAtMs: 500 }))

    expect(medium.quality).toBe('needs-work')
    expect(low.quality).toBe('needs-work')
  })

  it('lists failed rules with the most severe first, whatever their order in the skill', () => {
    const evaluator = new RepEvaluator(
      skillWithRules([
        rule('tempo', 'descentMs >= 800', 'low'),
        rule('torso', 'max(torso) <= 45', 'medium'),
        rule('depth', 'min(knee) <= 100', 'high')
      ])
    )

    const result = evaluator.evaluate(
      makeRep({ knee: [170, 130, 120, 170], torso: [10, 60, 10, 10], bottomAtMs: 400 })
    )

    expect(result.failed.map((outcome) => outcome.ruleId)).toEqual(['depth', 'torso', 'tempo'])
    expect(result.outcomes.map((outcome) => outcome.ruleId)).toEqual(['tempo', 'torso', 'depth'])
  })

  it('judges by the time of the movement', () => {
    const evaluator = new RepEvaluator(
      skillWithRules([rule('control', 'descentMs >= 800 && durationMs <= 3000', 'low')])
    )

    expect(evaluator.evaluate(makeRep({ bottomAtMs: 900 })).quality).toBe('good')
    expect(evaluator.evaluate(makeRep({ bottomAtMs: 500 })).quality).toBe('needs-work')
    expect(evaluator.evaluate(makeRep({ bottomAtMs: 900, durationMs: 4000 })).quality).toBe(
      'needs-work'
    )
  })

  it('does not blame the user for a rule it could not judge', () => {
    const evaluator = new RepEvaluator(
      skillWithRules([rule('depth', 'min(knee) <= 100'), rule('torso', 'max(torso) <= 45', 'low')])
    )

    const result = evaluator.evaluate(makeRep({ knee: [170, 90, 170], torso: [null, null, null] }))

    expect(result.outcomes.map((outcome) => outcome.status)).toEqual(['passed', 'unknown'])
    expect(result.failed).toEqual([])
    expect(result.quality).toBe('good')
  })

  it('reports an unknown quality when nothing could be judged', () => {
    const evaluator = new RepEvaluator(skillWithRules([rule('depth', 'min(knee) <= 100')]))

    const result = evaluator.evaluate(makeRep({ knee: [null, null, null] }))

    expect(result.quality).toBe('unknown')
    expect(result.failed).toEqual([])
  })

  it('skips the rules that are meant to run live', () => {
    const evaluator = new RepEvaluator(
      skillWithRules([
        rule('depth', 'min(knee) <= 100'),
        rule('safety', 'max(torso) <= 20', 'high', { live: true })
      ])
    )

    const result = evaluator.evaluate(makeRep({ torso: [10, 50, 10, 50, 10] }))

    expect(result.outcomes.map((outcome) => outcome.ruleId)).toEqual(['depth'])
    expect(result.quality).toBe('good')
  })

  it('carries the number and duration of the repetition', () => {
    const evaluator = new RepEvaluator(skillWithRules([rule('depth', 'min(knee) <= 100')]))

    const result = evaluator.evaluate(makeRep({ index: 7, durationMs: 1800 }))

    expect(result.repIndex).toBe(7)
    expect(result.durationMs).toBe(1800)
  })

  it('judges each repetition on its own', () => {
    const evaluator = new RepEvaluator(skillWithRules([rule('depth', 'min(knee) <= 100')]))

    expect(evaluator.evaluate(makeRep({ knee: [170, 90, 170] })).quality).toBe('good')
    expect(evaluator.evaluate(makeRep({ knee: [170, 130, 170] })).quality).toBe('bad')
    expect(evaluator.evaluate(makeRep({ knee: [170, 90, 170] })).quality).toBe('good')
  })

  it('refuses a skill with a rule that cannot be compiled, naming it', () => {
    const broken = {
      ...validSkillInput,
      rules: [rule('depth', 'min(knee) <= 100')]
    } as unknown as SkillConfig
    broken.rules = [{ ...broken.rules[0]!, id: 'bad_rule', check: 'knee <= 100' }]

    expect(() => new RepEvaluator(broken)).toThrow(/rule "bad_rule" of "squat"/)
  })
})
