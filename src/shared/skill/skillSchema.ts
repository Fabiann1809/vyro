import { z } from 'zod'
import { diagramRefSchema, MAX_DIAGRAMS } from '../diagrams'
import { MAX_TIP_LENGTH, MAX_TIPS } from '../guide'
import { DISPLAYS } from './display'
import { PROGRESS_MEASURES, PROGRESS_UNITS } from './progress'
import { ANY_JOINT_NAMES } from './joints'
import { DETECTABLE_OBJECTS } from './objects'
import { INSTRUMENTS } from './instruments'
import { isAudioMetric, isObjectMetric } from './skillChannels'

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

const joint = z.enum(ANY_JOINT_NAMES)

const localizedText = z
  .object({
    es: z.string().trim().min(1, 'the Spanish text is required'),
    en: z.string().trim().min(1, 'the English text is required')
  })
  .strict()

// A short line of advice, in both languages.
const localizedTip = z
  .object({
    es: z.string().trim().min(1, 'the Spanish text is required').max(MAX_TIP_LENGTH),
    en: z.string().trim().min(1, 'the English text is required').max(MAX_TIP_LENGTH)
  })
  .strict()

// What helps to learn the skill, written by hand for the skills that come with the app: how to
// do it, what the app does NOT check (so the person knows what is left to them) and the drawings
// that go with it, by name (D18).
const skillGuide = z
  .object({
    tips: z.array(localizedTip).min(1).max(MAX_TIPS),
    notMeasured: z.array(localizedTip).max(4).default([]),
    diagrams: z.array(diagramRefSchema).max(MAX_DIAGRAMS).default([])
  })
  .strict()

// What the person sees as progress: the name of an attempt and the numbers of a session.
const skillProgress = z
  .object({
    unit: z.enum(PROGRESS_UNITS).default('reps'),
    measures: z.array(z.enum(PROGRESS_MEASURES)).max(PROGRESS_MEASURES.length).default([])
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

// Straight-line distance between two points, divided by the length of `scale`: how far apart two
// fingertips are, in palms for example.
const gapMetric = z
  .object({
    type: z.literal('gap'),
    from: joint,
    to: joint,
    scale: z.tuple([joint, joint])
  })
  .strict()

// Object metrics. They look at the box the detector draws around the object (a skill names the
// object in its `object` field).
// Where the centre of the box is compared with a point of the body or the hand, along one axis, in
// units of `scale`: positive when the object is to the right of (x) or below (y) the point.
const objectOffsetMetric = z
  .object({
    type: z.literal('objectOffset'),
    to: joint,
    axis: z.enum(['x', 'y']),
    scale: z.tuple([joint, joint])
  })
  .strict()

// Width over height of the box: above 1 the object lies across the picture, below 1 it stands up.
// A box has no slant, so this is how far the object is from level or upright, not an angle.
const objectAspectMetric = z.object({ type: z.literal('objectAspect') }).strict()

// Audio metrics. They look at what the microphone hears, not at the body.
// How far the pitch is from a note, in cents (positive when higher). "nearest" measures it from the
// closest note, whichever it is, which is what tuning a string needs.
const noteName = z.string().regex(/^[A-G][#b]?-?\d$/, 'must be a note such as "A4", "E2" or "C#3"')
const pitchMetric = z
  .object({ type: z.literal('pitch'), target: z.union([noteName, z.literal('nearest')]) })
  .strict()

// How loud the sound is, in dBFS (0 is the loudest, quiet rooms are around -60).
const levelMetric = z.object({ type: z.literal('level') }).strict()

// How far the step between the last two notes is from the one asked for, in cents. A step of
// `semitones` is exact when the value is 0.
const intervalMetric = z
  .object({ type: z.literal('interval'), semitones: z.number().int().min(-24).max(24) })
  .strict()

// The beats per minute of the last notes.
const tempoMetric = z.object({ type: z.literal('tempo') }).strict()

// How sure the sound is of being this instrument, from 0 to 1. Only instruments of the known list
// can be named. Rules usually read its average ("avg(flute) >= 0.5").
const instrumentMetric = z
  .object({ type: z.literal('instrument'), name: z.enum(INSTRUMENTS) })
  .strict()

const metric = z.discriminatedUnion('type', [
  angleMetric,
  tiltMetric,
  offsetMetric,
  gapMetric,
  objectOffsetMetric,
  objectAspectMetric,
  pitchMetric,
  levelMetric,
  intervalMetric,
  tempoMetric,
  instrumentMetric
])

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
    // Skills that only listen have no use for the camera and leave this out.
    camera: z
      .object({
        view: z.enum(['side', 'front']),
        fullBody: z.boolean(),
        side: z.enum(['auto', 'left', 'right']).default('auto'),
        // Which hand the hand points of the metrics belong to.
        hand: z.enum(['auto', 'left', 'right']).default('auto')
      })
      .strict()
      .optional(),
    // The object the skill looks at, for the metrics of an object.
    object: z.enum(DETECTABLE_OBJECTS).optional(),
    // Only for skills that listen.
    audio: z
      .object({
        // The pitch of the A above middle C. Some instruments are tuned to 432 or 442.
        a4: z.number().min(400).max(480).default(440)
      })
      .strict()
      .optional(),
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
        minDurationMs: z.number().int().positive(),
        // For a posture that is held rather than a movement: the middle step of the sequence counts
        // as a repetition once the person has stayed in it this long, even if they were already there
        // when the skill began. The first and last step are then where they are not in position.
        holdMs: z.number().int().positive().optional()
      })
      .strict(),
    rules: z.array(rule).min(1, 'needs at least one rule'),
    guide: skillGuide.optional(),
    progress: skillProgress.optional(),
    // How the practice screen shows the skill; counted when left out.
    display: z.enum(DISPLAYS).optional()
  })
  .strict()
  .superRefine((skill, ctx) => {
    const metricNames = Object.keys(skill.metrics)

    if (!skill.camera && Object.values(skill.metrics).some((item) => !isAudioMetric(item))) {
      ctx.addIssue({
        code: 'custom',
        path: ['camera'],
        message: 'is needed when the skill looks at the body or the hands'
      })
    }

    if (!skill.object && Object.values(skill.metrics).some(isObjectMetric)) {
      ctx.addIssue({
        code: 'custom',
        path: ['object'],
        message: 'is needed when a metric looks at an object'
      })
    }

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

    const { sequence, holdMs } = skill.rep
    if (holdMs !== undefined && sequence.length !== 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['rep', 'holdMs'],
        message: 'a held posture needs a sequence of exactly three steps: away, in position, away'
      })
    }
    const measures = skill.progress?.measures ?? []
    if (new Set(measures).size !== measures.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['progress', 'measures'],
        message: 'a measure is listed twice'
      })
    }
    if (measures.includes('timeWell') && holdMs === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['progress', 'measures'],
        message: '"timeWell" needs "rep.holdMs": it adds up the time of the held attempts'
      })
    }
    const hasPitch = Object.values(skill.metrics).some((item) => item.type === 'pitch')
    if ((skill.display === 'tuner' || skill.display === 'target-note') && !hasPitch) {
      ctx.addIssue({
        code: 'custom',
        path: ['display'],
        message: `"${skill.display}" shows a note, so the skill needs a "pitch" metric`
      })
    }
    if (skill.display === 'hold' && holdMs === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['display'],
        message: '"hold" shows a posture that is kept, so the skill needs "rep.holdMs"'
      })
    }
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
