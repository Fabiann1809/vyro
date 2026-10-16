import type { RepQuality, RepResult } from './repEvaluator'

export interface FrequentError {
  ruleId: string
  count: number
  message: { es: string; en: string }
}

export interface SessionSummary {
  // Repetitions that could be judged; those the body could not be measured in are left out.
  judged: number
  good: number
  needsWork: number
  bad: number
  // 0..100, or null when no repetition could be judged.
  score: number | null
  // Most frequent first.
  errors: FrequentError[]
  // The quality of each repetition in order, to see whether the technique fades.
  qualities: RepQuality[]
}

// A good repetition is worth everything, one that needs work half, a bad one nothing.
const POINTS: Record<RepQuality, number> = { good: 1, 'needs-work': 0.5, bad: 0, unknown: 0 }

export function summarizeSession(results: readonly RepResult[]): SessionSummary {
  const judgedResults = results.filter((result) => result.quality !== 'unknown')
  const count = (quality: RepQuality): number =>
    judgedResults.filter((result) => result.quality === quality).length

  const points = judgedResults.reduce((sum, result) => sum + POINTS[result.quality], 0)
  const score = judgedResults.length > 0 ? Math.round((100 * points) / judgedResults.length) : null

  return {
    judged: judgedResults.length,
    good: count('good'),
    needsWork: count('needs-work'),
    bad: count('bad'),
    score,
    errors: frequentErrors(results),
    qualities: results.map((result) => result.quality)
  }
}

function frequentErrors(results: readonly RepResult[]): FrequentError[] {
  const byRule = new Map<string, FrequentError>()

  for (const outcome of results.flatMap((result) => result.failed)) {
    const known = byRule.get(outcome.ruleId)
    if (known) known.count++
    else byRule.set(outcome.ruleId, { ruleId: outcome.ruleId, count: 1, message: outcome.message })
  }

  // Sort is stable, so errors with the same count keep the order in which they first happened.
  return [...byRule.values()].sort((a, b) => b.count - a.count)
}
