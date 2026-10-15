import { z } from 'zod'
import { JOINT_NAMES } from '@renderer/core/side'

// Names the rule expressions already use (functions and per-repetition values). A metric called
// like one of them would be ambiguous inside an expression.
export const RESERVED_NAMES = [
  'min',
  'max',
  'range',
  'avg',
  'first',
  'last',
  'abs',
  'durationMs',
  'descentMs',
  'ascentMs'
] as const

// zod reports a bad key of a record with a generic message, so metric names are checked
// in the cross-checks at the bottom, where the message can say what is wrong.
function metricNameProblem(name: string): string | undefined {
  if (!/^[a-z][A-Za-z0-9]*$/.test(name)) {
    return `invalid metric name "${name}": it must start with a lowercase letter and contain only letters and digits`
  }
  if (name in Object.prototype) {
    return `invalid metric name "${name}": it is a built-in JavaScript property name`
  }
  if ((RESERVED_NAMES as readonly string[]).includes(name)) {
    return `invalid metric name "${name}": it is reserved by the expression language (${RESERVED_NAMES.join(', ')})`
  }
  return undefined
}

const identifier = z
  .string()
  .regex(
    /^[a-z][a-z0-9_]*$/,
    'must be lowercase letters, digits or underscores, starting with a letter'
  )

const joint = z.enum(JOINT_NAMES)

const localizedText = z
  .object({
    es: z.string().trim().min(1, 'the Spanish text is required'),
    en: z.string().trim().min(1, 'the English text is required')
  })
  .strict()

// Angle at the middle joint between the other two (for example hip, knee, ankle → knee angle).
const angleMetric = z
  .object({ type: z.literal('angle'), points: z.tuple([joint, joint, joint]) })
  .strict()

// Angle between the segment from→to and the vertical (0 = straight up, 90 = level).
const tiltMetric = z.object({ type: z.literal('tilt'), from: joint, to: joint }).strict()

// Distance from→to along one axis, divided by the length of `scale`, so it does not depend on
// how far the user stands from the camera.
const offsetMetric = z
  .object({
    type: z.literal('offset'),
    from: joint,
    to: joint,
    axis: z.enum(['x', 'y']),
    scale: z.tuple([joint, joint])
  })
  .strict()

const metric = z.discriminatedUnion('type', [angleMetric, tiltMetric, offsetMetric])

const threshold = z
  .object({ gt: z.number().optional(), lt: z.number().optional() })
  .strict()
  .refine((value) => value.gt !== undefined || value.lt !== undefined, {
    message: 'needs at least one of "gt" (greater than) or "lt" (less than)'
  })

const phase = z
  .object({
    id: identifier,
    // Every condition must hold at the same time for the body to be in this phase.
    when: z
      .record(z.string(), threshold)
      .refine((when) => Object.keys(when).length > 0, { message: 'needs at least one condition' })
  })
  .strict()

const rule = z
  .object({
    id: identifier,
    severity: z.enum(['high', 'medium', 'low']),
    // Checked at the end of each repetition, unless `live` is true (safety rules only).
    live: z.boolean().default(false),
    check: z.string().trim().min(1, 'the check expression is required'),
    message: localizedText
  })
  .strict()

export const skillConfigSchema = z
  .object({
    id: identifier,
    category: identifier,
    name: localizedText,
    camera: z
      .object({
        view: z.enum(['side', 'front']),
        fullBody: z.boolean(),
        side: z.enum(['auto', 'left', 'right']).default('auto')
      })
      .strict(),
    metrics: z.record(z.string(), metric).refine((metrics) => Object.keys(metrics).length > 0, {
      message: 'needs at least one metric'
    }),
    phases: z.array(phase).min(2, 'needs at least two phases'),
    rep: z
      .object({
        // The phases a repetition goes through, in order, starting and ending in the same one.
        sequence: z
          .array(identifier)
          .min(3, 'needs at least three steps, for example up, down, up'),
        minDurationMs: z.number().int().positive()
      })
      .strict(),
    rules: z.array(rule).min(1, 'needs at least one rule')
  })
  .strict()
  .superRefine((skill, ctx) => {
    const metricNames = Object.keys(skill.metrics)

    for (const name of metricNames) {
      const problem = metricNameProblem(name)
      if (problem) ctx.addIssue({ code: 'custom', path: ['metrics', name], message: problem })
    }

    const reportDuplicates = (ids: string[], path: 'phases' | 'rules'): void => {
      const seen = new Set<string>()
      ids.forEach((id, index) => {
        if (seen.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: [path, index, 'id'],
            message: `duplicate id "${id}"`
          })
        }
        seen.add(id)
      })
    }
    reportDuplicates(
      skill.phases.map((item) => item.id),
      'phases'
    )
    reportDuplicates(
      skill.rules.map((item) => item.id),
      'rules'
    )

    skill.phases.forEach((item, phaseIndex) => {
      for (const name of Object.keys(item.when)) {
        if (!metricNames.includes(name)) {
          ctx.addIssue({
            code: 'custom',
            path: ['phases', phaseIndex, 'when', name],
            message: `phase "${item.id}" uses the unknown metric "${name}"`
          })
        }
      }
    })

    const phaseIds = new Set(skill.phases.map((item) => item.id))
    skill.rep.sequence.forEach((id, index) => {
      if (!phaseIds.has(id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rep', 'sequence', index],
          message: `the sequence uses the unknown phase "${id}"`
        })
      }
    })

    const { sequence } = skill.rep
    if (sequence.length >= 3 && sequence[0] !== sequence[sequence.length - 1]) {
      ctx.addIssue({
        code: 'custom',
        path: ['rep', 'sequence'],
        message: 'a repetition must start and end in the same phase'
      })
    }
  })

export type SkillConfig = z.infer<typeof skillConfigSchema>
export type SkillMetric = SkillConfig['metrics'][string]
export type SkillRule = SkillConfig['rules'][number]
export type Severity = SkillRule['severity']
