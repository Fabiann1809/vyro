import { cameraOf } from './cameraOf'
import { GUITAR_POSTURE_ID, mentionsGuitar } from './guitar'
import { skillChannels } from './skillChannels'
import type { SkillConfig, SkillMetric } from './skillSchema'

export const GENERATED_ID_PREFIX = 'custom_'

const MIN_REP_MS = 200
const MAX_REP_MS = 10_000

// Skills made by the coach are experimental: this is how the app tells them from the ones that
// come with it.
export const isGeneratedSkillId = (id: string): boolean => id.startsWith(GENERATED_ID_PREFIX)

// Values that a metric can really take. Angles and tilts are in degrees; an offset is a fraction
// of a body segment, so a few units at most.
function plausibleRange(metric: SkillMetric): [number, number] {
  switch (metric.type) {
    case 'offset':
      return [-3, 3]
    case 'gap':
      return [0, 5]
    case 'pitch':
    case 'interval':
      return [-1200, 1200]
    case 'level':
      return [-100, 0]
    case 'tempo':
      return [30, 240]
    default:
      return [0, 180]
  }
}

function thresholdProblems(skill: SkillConfig): string[] {
  return skill.phases.flatMap((phase, index) =>
    Object.entries(phase.when).flatMap(([name, { gt, lt }]) => {
      const metric = skill.metrics[name]
      if (!metric) return []
      const [low, high] = plausibleRange(metric)
      const where = `phases.${index}.when.${name}`
      const problems: string[] = []
      for (const value of [gt, lt]) {
        if (value !== undefined && (value < low || value > high)) {
          problems.push(
            `${where}: ${value} is outside what "${name}" can measure (${low} to ${high})`
          )
        }
      }
      if (gt !== undefined && lt !== undefined && gt >= lt) {
        problems.push(`${where}: "gt" must be less than "lt", or the phase can never happen`)
      }
      return problems
    })
  )
}

// A guitar lesson teaches with the hand and the sound, seen from the front. The posture is judged
// once, in its own skill that comes with the app, and not again in every lesson. Checked when the
// coach makes a skill, not when one is loaded, so a lesson made earlier keeps working.
export function guitarLessonProblems(skill: SkillConfig): string[] {
  if (!mentionsGuitar(skill)) return []
  const problems: string[] = []
  if (skillChannels(skill).includes('body')) {
    problems.push(
      `metrics: a guitar lesson must not measure the body (shoulder, elbow, wrist, hip...). The posture has its own skill, "${GUITAR_POSTURE_ID}". Measure the hand, the guitar and the sound.`
    )
  }
  if (cameraOf(skill).view !== 'front') {
    problems.push('camera.view: a guitar lesson is filmed from the front, so use "front".')
  }
  return problems
}

// Extra limits for a skill that nobody reviewed. Each problem is a sentence the coach can act on.
export function generatedSkillProblems(skill: SkillConfig): string[] {
  const problems: string[] = []
  if (!isGeneratedSkillId(skill.id)) {
    problems.push(`id: "${skill.id}" must start with "${GENERATED_ID_PREFIX}"`)
  }
  if (!skill.rules.some((rule) => rule.severity === 'high')) {
    problems.push('rules: needs at least one rule with severity "high", the one that matters most')
  }
  if (skill.rep.minDurationMs < MIN_REP_MS || skill.rep.minDurationMs > MAX_REP_MS) {
    problems.push(`rep.minDurationMs: must be between ${MIN_REP_MS} and ${MAX_REP_MS} milliseconds`)
  }
  return [...problems, ...thresholdProblems(skill)]
}
