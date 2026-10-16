import { compileExpression, type CompiledExpression, type EvalContext } from './expression'
import type { RepQuality } from '@shared/sessions'
import type { CompletedRep } from './repCounter'
import type { Severity, SkillConfig } from './skillSchema'

export type RuleStatus = 'passed' | 'failed' | 'unknown'

// Defined in @shared/sessions, since the database stores it too.
export type { RepQuality }

export interface RuleOutcome {
  ruleId: string
  severity: Severity
  status: RuleStatus
  message: { es: string; en: string }
}

export interface RepResult {
  repIndex: number
  quality: RepQuality
  durationMs: number
  // One outcome per rule that is checked at the end of a repetition, in the order of the skill.
  outcomes: RuleOutcome[]
  // Only the rules that failed, most severe first.
  failed: RuleOutcome[]
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

// Turns the frames of a repetition into the values that the rule expressions can talk about.
//
// - Each metric becomes a series with the frames where it could be measured.
// - The turning point is the middle step of the sequence (the bottom of a squat, the top of a
//   curl). descentMs is the time from the start of the movement until it, and ascentMs from it
//   until the body is back at the start.
export function buildContext(rep: CompletedRep, metricNames: readonly string[]): EvalContext {
  const series: Record<string, number[]> = Object.fromEntries(metricNames.map((name) => [name, []]))

  for (const sample of rep.samples) {
    for (const name of metricNames) {
      const value = sample.values[name]
      if (typeof value === 'number') series[name]?.push(value)
    }
  }

  const turningPoint = rep.steps[Math.floor((rep.steps.length - 1) / 2)]
  const scalars: EvalContext['scalars'] = { durationMs: rep.durationMs }

  return {
    series,
    scalars: turningPoint
      ? {
          ...scalars,
          descentMs: turningPoint.timestampMs - rep.startMs,
          ascentMs: rep.endMs - turningPoint.timestampMs
        }
      : scalars
  }
}

function qualityOf(outcomes: readonly RuleOutcome[]): RepQuality {
  if (outcomes.length > 0 && outcomes.every((outcome) => outcome.status === 'unknown')) {
    return 'unknown'
  }
  const failed = outcomes.filter((outcome) => outcome.status === 'failed')
  if (failed.some((outcome) => outcome.severity === 'high')) return 'bad'
  return failed.length > 0 ? 'needs-work' : 'good'
}

interface CompiledRule {
  definition: SkillConfig['rules'][number]
  expression: CompiledExpression
}

// Judges finished repetitions against the rules of a skill. Rules marked `live` are for the
// feedback that runs while the body moves and are not part of this end-of-repetition verdict.
export class RepEvaluator {
  private readonly metricNames: string[]
  private readonly rules: CompiledRule[]

  constructor(skill: SkillConfig) {
    this.metricNames = Object.keys(skill.metrics)
    this.rules = skill.rules
      .filter((rule) => !rule.live)
      .map((definition) => {
        const compiled = compileExpression(definition.check, this.metricNames)
        if (!compiled.ok) {
          throw new Error(`rule "${definition.id}" of "${skill.id}": ${compiled.error}`)
        }
        return { definition, expression: compiled.expression }
      })
  }

  evaluate(rep: CompletedRep): RepResult {
    const context = buildContext(rep, this.metricNames)

    const outcomes = this.rules.map(({ definition, expression }): RuleOutcome => {
      const holds = expression.evaluate(context)
      return {
        ruleId: definition.id,
        severity: definition.severity,
        status: holds === null ? 'unknown' : holds ? 'passed' : 'failed',
        message: definition.message
      }
    })

    return {
      repIndex: rep.index,
      quality: qualityOf(outcomes),
      durationMs: rep.durationMs,
      outcomes,
      failed: outcomes
        .filter((outcome) => outcome.status === 'failed')
        .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    }
  }
}
