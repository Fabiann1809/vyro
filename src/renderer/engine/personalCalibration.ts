import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig, SkillMetric } from '@shared/skill/skillSchema'
import type { CompletedRep } from './repCounter'
import { buildContext } from './repEvaluator'

// A threshold of a rule can move at most this much (as a fraction of itself) from what the coach
// wrote: the repetition of one person is evidence, not a reason to throw the skill away.
const MAX_SHIFT = 0.5
// How far from the good repetition the threshold is put, so that the same movement on another day
// still passes: a share of the value, and never less than a floor in the units of the measure.
const MARGIN_SHARE = 0.15
const FLOOR_DEGREES = 3
const FLOOR_OFFSET = 0.03
const FLOOR_MS = 100

export interface ThresholdChange {
  ruleId: string
  from: number
  to: number
}

export interface PersonalCalibration {
  skill: SkillConfig
  // Only the thresholds that moved.
  changes: ThresholdChange[]
}

// Both kinds of clause a rule can be made of: a value of a metric over the repetition
// ("min(knee) <= 100") or a time ("descentMs >= 500"). Anything else in a rule is left alone, and
// so is a clause inside arithmetic, where the number is not the threshold.
const NOT_IN_ARITHMETIC_BEFORE = '(?<![-+*/]\\s*)'
const NOT_IN_ARITHMETIC_AFTER = '(?!\\s*[-+*/.\\d])'
const METRIC_CLAUSE = new RegExp(
  `${NOT_IN_ARITHMETIC_BEFORE}\\b(min|max|range|avg|first|last)\\(([A-Za-z][A-Za-z0-9]*)\\)\\s*(<=|>=|<|>)\\s*(-?\\d+(?:\\.\\d+)?)${NOT_IN_ARITHMETIC_AFTER}`,
  'g'
)
const TIME_CLAUSE = new RegExp(
  `${NOT_IN_ARITHMETIC_BEFORE}\\b(durationMs|descentMs|ascentMs)\\s*(<=|>=|<|>)\\s*(\\d+(?:\\.\\d+)?)${NOT_IN_ARITHMETIC_AFTER}`,
  'g'
)

function aggregate(name: string, values: readonly number[]): number | null {
  if (values.length === 0) return null
  switch (name) {
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    case 'range':
      return Math.max(...values) - Math.min(...values)
    case 'avg':
      return values.reduce((sum, value) => sum + value, 0) / values.length
    case 'first':
      return values[0] ?? null
    default:
      return values[values.length - 1] ?? null
  }
}

const floorOf = (metric: SkillMetric | undefined): number =>
  metric?.type === 'offset' || metric?.type === 'gap' ? FLOOR_OFFSET : FLOOR_DEGREES

// Where the threshold goes so that the good repetition passes with room to spare. A clause that
// asks for at most something ("<") is put above the value, one that asks for at least something
// (">") below it. Null when the value is too far from what was written to be taken as that
// person's version of the same movement.
function personalThreshold(
  value: number,
  operator: string,
  original: number,
  floor: number
): number | null {
  const margin = Math.max(Math.abs(value) * MARGIN_SHARE, floor)
  const reach = Math.abs(original) * MAX_SHIFT
  if (reach === 0 || Math.abs(value - original) >= reach) return null

  const wantsAtMost = operator.startsWith('<')
  const moved = wantsAtMost ? value + margin : value - margin
  const bounded = Math.min(Math.max(moved, original - reach), original + reach)
  return Number(bounded.toFixed(2))
}

// Adjusts the thresholds of the rules to one repetition that the person did well, and says which
// moved. The phases are not touched: the repetition was counted through them, so the person
// reaches them already. If anything goes wrong the skill comes back as it was.
export function personalizeSkill(skill: SkillConfig, rep: CompletedRep): PersonalCalibration {
  const metricNames = Object.keys(skill.metrics)
  const context = buildContext(rep, metricNames)
  const changes: ThresholdChange[] = []

  const rules = skill.rules.map((rule) => {
    if (rule.live) return rule

    const adjust = (
      original: number,
      value: number | null,
      operator: string,
      floor: number
    ): string | null => {
      if (value === null) return null
      const next = personalThreshold(value, operator, original, floor)
      if (next === null || next === original) return null
      changes.push({ ruleId: rule.id, from: original, to: next })
      return String(next)
    }

    const withMetrics = rule.check.replace(
      METRIC_CLAUSE,
      (clause, fn: string, metric: string, operator: string, number: string) => {
        const value = aggregate(fn, context.series[metric] ?? [])
        const next = adjust(Number(number), value, operator, floorOf(skill.metrics[metric]))
        return next === null ? clause : `${fn}(${metric}) ${operator} ${next}`
      }
    )
    const check = withMetrics.replace(
      TIME_CLAUSE,
      (clause, name: string, operator: string, number: string) => {
        const value = context.scalars[name as 'durationMs' | 'descentMs' | 'ascentMs'] ?? null
        const next = adjust(Number(number), value, operator, FLOOR_MS)
        return next === null ? clause : `${name} ${operator} ${next}`
      }
    )
    return { ...rule, check }
  })

  const parsed = parseSkillConfig({ ...skill, rules })
  return parsed.ok ? { skill: parsed.skill, changes } : { skill, changes: [] }
}
