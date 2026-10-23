import { describe, expect, it } from 'vitest'
import { depthRule as rule, kneeMetric, validSkillInput as validSkill } from './skillFixtures'
import { skillConfigSchema } from './skillSchema'

// Validation messages as "path: message", after replacing some top-level sections.
function problemsWith(overrides: Record<string, unknown>): string[] {
  const result = skillConfigSchema.safeParse({ ...validSkill, ...overrides })
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

describe('the guide of a skill', () => {
  const tip = { es: 'Baja despacio.', en: 'Go down slowly.' }

  it('is optional, and its lists have no entries when left out', () => {
    expect(skillConfigSchema.parse(validSkill).guide).toBeUndefined()

    const guide = skillConfigSchema.parse({ ...validSkill, guide: { tips: [tip] } }).guide
    expect(guide).toEqual({ tips: [tip], notMeasured: [], diagrams: [] })
  })

  it.each([
    ['no tips', { tips: [] }],
    ['more than five tips', { tips: Array(6).fill(tip) }],
    ['a tip without its English text', { tips: [{ es: 'Baja despacio.' }] }],
    ['a tip that is too long', { tips: [{ es: 'x'.repeat(161), en: 'x' }] }],
    ['more than four things not measured', { tips: [tip], notMeasured: Array(5).fill(tip) }],
    [
      'a diagram that is not in the library',
      { tips: [tip], diagrams: [{ kind: 'chord', name: 'Zz' }] }
    ],
    ['a field that is not listed', { tips: [tip], video: 'x' }]
  ])('rejects %s', (_name, guide) => {
    expect(problemsWith({ guide }).length).toBeGreaterThan(0)
  })
})

describe('the progress of a skill', () => {
  it('counts repetitions, with no measures, when left out', () => {
    expect(skillConfigSchema.parse(validSkill).progress).toBeUndefined()

    const progress = skillConfigSchema.parse({ ...validSkill, progress: {} }).progress
    expect(progress).toEqual({ unit: 'reps', measures: [] })
  })

  it('accepts a unit with the measures that fit it', () => {
    const progress = { unit: 'attempts', measures: ['cleanRate', 'bestStreak', 'vsPrevious'] }

    expect(problemsWith({ progress })).toEqual([])
  })

  it.each([
    ['a unit that does not exist', { unit: 'laps' }],
    ['a measure that does not exist', { measures: ['speed'] }],
    ['a measure listed twice', { measures: ['cleanRate', 'cleanRate'] }],
    ['a field that is not listed', { unit: 'reps', color: 'red' }]
  ])('rejects %s', (_name, progress) => {
    expect(problemsWith({ progress }).length).toBeGreaterThan(0)
  })

  it('rejects "timeWell" unless the attempts are held', () => {
    const progress = { unit: 'holds', measures: ['timeWell'] }

    expect(problemsWith({ progress }).join()).toContain('rep.holdMs')
  })

  it('accepts "timeWell" when the attempts are held', () => {
    const rep = { sequence: ['up', 'down', 'up'], minDurationMs: 800, holdMs: 3000 }
    const progress = { unit: 'holds', measures: ['timeWell'] }

    expect(problemsWith({ rep, progress })).toEqual([])
  })
})

describe('skillConfigSchema', () => {
  it('accepts a valid skill', () => {
    expect(skillConfigSchema.safeParse(validSkill).success).toBe(true)
  })

  it('fills the defaults: automatic side and end-of-repetition rules', () => {
    const skill = skillConfigSchema.parse(validSkill)

    expect(skill.camera?.side).toBe('auto')
    expect(skill.rules[0]?.live).toBe(false)
  })

  describe('metrics', () => {
    it('rejects a joint that does not exist', () => {
      const problems = problemsWith({
        metrics: { knee: { type: 'angle', points: ['hip', 'kneee', 'ankle'] } }
      })

      expect(problems.join()).toContain('metrics.knee.points.1')
    })

    it('rejects an angle that does not have exactly three points', () => {
      const problems = problemsWith({
        metrics: { knee: { type: 'angle', points: ['hip', 'knee'] } }
      })

      expect(problems.join()).toContain('metrics.knee.points')
    })

    it('rejects an unknown metric type', () => {
      const problems = problemsWith({ metrics: { knee: { ...kneeMetric, type: 'speed' } } })

      expect(problems.length).toBeGreaterThan(0)
    })

    it('rejects a metric name that the expression language already uses', () => {
      const problems = problemsWith({ metrics: { min: kneeMetric, knee: kneeMetric } })

      expect(problems.join()).toContain(
        'invalid metric name "min": it is reserved by the expression language'
      )
    })

    it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty'])(
      'rejects %s, a name that already exists on every JavaScript object',
      (name) => {
        const problems = problemsWith({ metrics: { [name]: kneeMetric, knee: kneeMetric } })

        expect(problems.join()).toContain('built-in JavaScript property name')
      }
    )

    it('rejects a metric name with invalid characters', () => {
      const problems = problemsWith({ metrics: { 'knee angle': kneeMetric, knee: kneeMetric } })

      expect(problems.join()).toContain('invalid metric name "knee angle"')
    })

    it('requires at least one metric', () => {
      expect(problemsWith({ metrics: {} }).join()).toContain('needs at least one metric')
    })
  })

  describe('phases', () => {
    it('rejects a phase that uses a metric that does not exist', () => {
      const problems = problemsWith({
        phases: [
          { id: 'up', when: { kne: { gt: 160 } } },
          { id: 'down', when: { knee: { lt: 110 } } }
        ]
      })

      expect(problems).toContain('phases.0.when.kne: phase "up" uses the unknown metric "kne"')
    })

    it('rejects a condition without gt or lt', () => {
      const problems = problemsWith({
        phases: [
          { id: 'up', when: { knee: {} } },
          { id: 'down', when: { knee: { lt: 110 } } }
        ]
      })

      expect(problems.join()).toContain('needs at least one of "gt"')
    })

    it('rejects a phase without conditions', () => {
      const problems = problemsWith({
        phases: [
          { id: 'up', when: {} },
          { id: 'down', when: { knee: { lt: 110 } } }
        ]
      })

      expect(problems.join()).toContain('needs at least one condition')
    })

    it('rejects duplicate phase ids', () => {
      const problems = problemsWith({
        phases: [
          { id: 'up', when: { knee: { gt: 160 } } },
          { id: 'up', when: { knee: { lt: 110 } } }
        ]
      })

      expect(problems).toContain('phases.1.id: duplicate id "up"')
    })

    it('requires at least two phases', () => {
      const problems = problemsWith({ phases: [{ id: 'up', when: { knee: { gt: 160 } } }] })

      expect(problems.join()).toContain('needs at least two phases')
    })
  })

  describe('repetition', () => {
    it('rejects a sequence that uses an unknown phase', () => {
      const problems = problemsWith({ rep: { sequence: ['up', 'dwn', 'up'], minDurationMs: 800 } })

      expect(problems).toContain('rep.sequence.1: the sequence uses the unknown phase "dwn"')
    })

    it('rejects a sequence that does not end where it started', () => {
      const problems = problemsWith({
        rep: { sequence: ['up', 'down', 'down'], minDurationMs: 800 }
      })

      expect(problems).toContain('rep.sequence: a repetition must start and end in the same phase')
    })

    it('rejects a sequence that is too short', () => {
      const problems = problemsWith({ rep: { sequence: ['up', 'up'], minDurationMs: 800 } })

      expect(problems.join()).toContain('needs at least three steps')
    })

    it.each([0, -5, 1.5])('rejects a minimum duration of %s', (minDurationMs) => {
      const problems = problemsWith({ rep: { sequence: ['up', 'down', 'up'], minDurationMs } })

      expect(problems.length).toBeGreaterThan(0)
    })
  })

  describe('rules', () => {
    it('rejects an unknown severity', () => {
      expect(problemsWith({ rules: [{ ...rule, severity: 'critical' }] }).length).toBeGreaterThan(0)
    })

    it('rejects duplicate rule ids', () => {
      expect(problemsWith({ rules: [rule, { ...rule }] })).toContain(
        'rules.1.id: duplicate id "depth"'
      )
    })

    it('requires the message in Spanish and in English', () => {
      const noEnglish = problemsWith({ rules: [{ ...rule, message: { es: 'Hola' } }] })
      const emptySpanish = problemsWith({ rules: [{ ...rule, message: { es: '  ', en: 'Hi' } }] })

      expect(noEnglish.join()).toContain('rules.0.message.en')
      expect(emptySpanish).toContain('rules.0.message.es: the Spanish text is required')
    })

    it('requires a check expression', () => {
      expect(problemsWith({ rules: [{ ...rule, check: ' ' }] }).join()).toContain(
        'the check expression is required'
      )
    })

    it('requires at least one rule', () => {
      expect(problemsWith({ rules: [] }).join()).toContain('needs at least one rule')
    })

    it('accepts live safety rules', () => {
      const skill = skillConfigSchema.parse({ ...validSkill, rules: [{ ...rule, live: true }] })

      expect(skill.rules[0]?.live).toBe(true)
    })
  })

  describe('object metrics', () => {
    const shape = {
      metrics: { lying: { type: 'objectAspect' } },
      phases: [
        { id: 'upright', when: { lying: { lt: 0.7 } } },
        { id: 'across', when: { lying: { gt: 1.5 } } }
      ],
      rep: { sequence: ['upright', 'across', 'upright'], minDurationMs: 100 },
      rules: [{ ...rule, check: 'max(lying) >= 1.5' }]
    }

    it('accepts a skill that names the object it looks at', () => {
      expect(problemsWith({ ...shape, object: 'guitar' })).toEqual([])
    })

    it('asks which object it is when a metric looks at one', () => {
      expect(problemsWith(shape).join()).toContain('object: is needed')
    })

    it('rejects an object that has no detector', () => {
      expect(problemsWith({ ...shape, object: 'dumbbell' }).length).toBeGreaterThan(0)
    })

    it('rejects a metric of an object that points at an unknown joint', () => {
      const problems = problemsWith({
        ...shape,
        object: 'guitar',
        metrics: {
          lying: {
            type: 'objectOffset',
            to: 'neck',
            axis: 'x',
            scale: ['shoulder', 'hip']
          }
        }
      })

      expect(problems.length).toBeGreaterThan(0)
    })
  })

  describe('general shape', () => {
    it('rejects a misspelled key instead of ignoring it', () => {
      const problems = problemsWith({ rules: [{ ...rule, mesage: rule.message }] })

      expect(problems.join()).toContain('rules.0')
    })

    it('rejects an id with spaces or capitals', () => {
      expect(problemsWith({ id: 'Bicep Curl' }).join()).toContain('lowercase')
    })

    it('rejects a missing camera section', () => {
      expect(problemsWith({ camera: undefined }).join()).toContain('camera')
    })

    it('rejects an unknown camera view', () => {
      expect(problemsWith({ camera: { view: 'top', fullBody: true } }).length).toBeGreaterThan(0)
    })

    it('rejects values that are not objects', () => {
      expect(skillConfigSchema.safeParse(null).success).toBe(false)
      expect(skillConfigSchema.safeParse('squat').success).toBe(false)
    })
  })
})
