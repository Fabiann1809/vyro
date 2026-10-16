import { describe, expect, it } from 'vitest'
import type { RepQuality, RepResult, RuleOutcome } from './repEvaluator'
import { buildSessionToSave, summarizeSession } from './sessionSummary'

const failure = (ruleId: string): RuleOutcome => ({
  ruleId,
  severity: 'medium',
  status: 'failed',
  message: { es: `corrige ${ruleId}`, en: `fix ${ruleId}` }
})

const rep = (quality: RepQuality, failedRules: string[] = []): RepResult => ({
  repIndex: 1,
  quality,
  durationMs: 2000,
  outcomes: [],
  failed: failedRules.map(failure)
})

describe('summarizeSession', () => {
  it('gives no score when nothing could be judged', () => {
    expect(summarizeSession([])).toMatchObject({ judged: 0, score: null, errors: [] })
    expect(summarizeSession([rep('unknown')])).toMatchObject({ judged: 0, score: null })
  })

  it('counts the repetitions by quality', () => {
    const summary = summarizeSession([
      rep('good'),
      rep('good'),
      rep('needs-work', ['torso']),
      rep('bad', ['depth'])
    ])

    expect(summary).toMatchObject({ judged: 4, good: 2, needsWork: 1, bad: 1 })
  })

  it('scores 100 for a perfect set and 0 for a set of bad repetitions', () => {
    expect(summarizeSession([rep('good'), rep('good')]).score).toBe(100)
    expect(summarizeSession([rep('bad', ['depth']), rep('bad', ['depth'])]).score).toBe(0)
  })

  it('gives half a point to a repetition that needs work', () => {
    expect(summarizeSession([rep('good'), rep('needs-work', ['torso'])]).score).toBe(75)
  })

  it('does not let unmeasurable repetitions pull the score down', () => {
    expect(summarizeSession([rep('good'), rep('unknown')]).score).toBe(100)
  })

  it('lists the errors from the most frequent one', () => {
    const summary = summarizeSession([
      rep('bad', ['depth', 'torso']),
      rep('bad', ['torso']),
      rep('needs-work', ['torso'])
    ])

    expect(summary.errors.map((error) => [error.ruleId, error.count])).toEqual([
      ['torso', 3],
      ['depth', 1]
    ])
  })

  it('keeps the quality of every repetition in order', () => {
    const summary = summarizeSession([rep('good'), rep('bad', ['depth']), rep('good')])

    expect(summary.qualities).toEqual(['good', 'bad', 'good'])
  })
})

describe('buildSessionToSave', () => {
  it('stores nothing for a session without repetitions', () => {
    expect(buildSessionToSave('squat', 1000, 60_000, [])).toBeNull()
  })

  it('keeps only numbers and the names of the failed rules', () => {
    const results = [
      { ...rep('good'), repIndex: 1, durationMs: 2000.4 },
      { ...rep('bad', ['depth', 'torso']), repIndex: 2 }
    ]

    expect(buildSessionToSave('squat', 1000, 60_000.6, results)).toEqual({
      skillId: 'squat',
      startedAt: 1000,
      durationMs: 60_001,
      score: 50,
      reps: [
        { index: 1, quality: 'good', durationMs: 2000, failedRuleIds: [] },
        { index: 2, quality: 'bad', durationMs: 2000, failedRuleIds: ['depth', 'torso'] }
      ]
    })
  })
})
