import type { SessionDigest } from '@shared/coach'
import type { SessionToSave } from '@shared/sessions'
import type { SkillConfig } from '@shared/skill/skillSchema'
import type { RepQuality, RepResult } from './repEvaluator'

export interface FrequentError {
  ruleId: string
  count: number
  message: { es: string; en: string }
}

// What is needed of an attempt to measure progress: also what a stored session keeps of it.
export interface Attempt {
  quality: RepQuality
  durationMs: number
}

// The numbers that say how well a session went, so one session can be set against another.
export interface SessionNumbers {
  // Repetitions that could be judged; those the body could not be measured in are left out.
  judged: number
  good: number
  needsWork: number
  bad: number
  // 0..100, or null when no repetition could be judged.
  score: number | null
  // 0..100: the share of the judged attempts that were good, or null when none could be judged.
  cleanRate: number | null
  // The time of the good attempts against the time of all the judged ones (0..100, or null).
  timeWell: number | null
  // The longest run of good attempts in a row, and how long that run lasted. An attempt that could
  // not be judged ends a run: nobody checked it, so the run cannot be claimed across it.
  bestStreak: number
  bestStreakMs: number
}

export interface SessionSummary extends SessionNumbers {
  // Most frequent first.
  errors: FrequentError[]
  // The quality of each repetition in order, to see whether the technique fades.
  qualities: RepQuality[]
}

// A good repetition is worth everything, one that needs work half, a bad one nothing.
const POINTS: Record<RepQuality, number> = { good: 1, 'needs-work': 0.5, bad: 0, unknown: 0 }

export function summarizeSession(results: readonly RepResult[]): SessionSummary {
  return {
    ...sessionNumbers(results),
    errors: frequentErrors(results),
    qualities: results.map((result) => result.quality)
  }
}

export function sessionNumbers(results: readonly Attempt[]): SessionNumbers {
  const judgedResults = results.filter((result) => result.quality !== 'unknown')
  const count = (quality: RepQuality): number =>
    judgedResults.filter((result) => result.quality === quality).length

  const points = judgedResults.reduce((sum, result) => sum + POINTS[result.quality], 0)
  const score = judgedResults.length > 0 ? Math.round((100 * points) / judgedResults.length) : null

  const streak = bestStreak(results)
  const judgedMs = sum(judgedResults.map((result) => result.durationMs))
  const goodMs = sum(
    judgedResults.filter((result) => result.quality === 'good').map((result) => result.durationMs)
  )

  return {
    judged: judgedResults.length,
    good: count('good'),
    needsWork: count('needs-work'),
    bad: count('bad'),
    score,
    cleanRate: percent(count('good'), judgedResults.length),
    timeWell: percent(goodMs, judgedMs),
    bestStreak: streak.count,
    bestStreakMs: streak.durationMs
  }
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)

// A share as a whole percent; null when there is nothing to divide by.
const percent = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((100 * part) / whole) : null

function bestStreak(results: readonly Attempt[]): { count: number; durationMs: number } {
  let best = { count: 0, durationMs: 0 }
  let current = { count: 0, durationMs: 0 }

  for (const result of results) {
    current =
      result.quality === 'good'
        ? { count: current.count + 1, durationMs: current.durationMs + result.durationMs }
        : { count: 0, durationMs: 0 }
    if (current.count > best.count) best = current
  }
  return best
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

// What is stored of a session: numbers and rule names only. A session without a single
// repetition says nothing about progress, so there is nothing to store (null).
export function buildSessionToSave(
  skillId: string,
  startedAt: number,
  durationMs: number,
  results: readonly RepResult[]
): SessionToSave | null {
  if (results.length === 0) return null

  return {
    skillId,
    startedAt,
    durationMs: Math.round(durationMs),
    score: summarizeSession(results).score,
    reps: results.map((result) => ({
      index: result.repIndex,
      quality: result.quality,
      durationMs: Math.round(result.durationMs),
      failedRuleIds: result.failed.map((outcome) => outcome.ruleId)
    }))
  }
}

// The numbers of a session, for the AI coach: counts, the score and the names of the rules that
// failed, nothing else. A session with no repetition has nothing to say, so no digest (null).
export function buildSessionDigest(
  skillId: string,
  startedAt: number,
  durationMs: number,
  results: readonly RepResult[],
  progress?: SkillConfig['progress']
): SessionDigest | null {
  if (results.length === 0) return null

  const summary = summarizeSession(results)
  const measures = progress?.measures ?? []
  return {
    skillId,
    startedAt,
    durationSeconds: Math.round(durationMs / 1000),
    repCount: results.length,
    goodCount: summary.good,
    needsWorkCount: summary.needsWork,
    badCount: summary.bad,
    score: summary.score,
    errors: summary.errors.map(({ ruleId, count }) => ({ ruleId, count })),
    // What the skill says about its progress goes along, and nothing it does not declare.
    ...(progress && { unit: progress.unit }),
    ...(measures.includes('cleanRate') && { cleanRate: summary.cleanRate }),
    ...(measures.includes('timeWell') && { timeWell: summary.timeWell }),
    ...(measures.includes('bestStreak') && {
      bestStreakSeconds: Math.round(summary.bestStreakMs / 1000)
    })
  }
}
