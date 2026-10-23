import { describe, expect, it } from 'vitest'
import { sessionDigestSchema } from '@shared/coach'
import type { SkillConfig } from '@shared/skill/skillSchema'
import type { RepQuality, RepResult, RuleOutcome } from './repEvaluator'
import { buildSessionDigest, buildSessionToSave, summarizeSession } from './sessionSummary'

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

const timed = (quality: RepQuality, durationMs: number): RepResult => ({
  ...rep(quality),
  durationMs
})

describe('the progress measures of a session', () => {
  it('has nothing to measure when no attempt could be judged', () => {
    expect(summarizeSession([])).toMatchObject({
      cleanRate: null,
      timeWell: null,
      bestStreak: 0,
      bestStreakMs: 0
    })
    expect(summarizeSession([rep('unknown')]).cleanRate).toBeNull()
  })

  it('is complete for a session of good attempts', () => {
    const summary = summarizeSession([timed('good', 3000), timed('good', 3000)])

    expect(summary).toMatchObject({
      cleanRate: 100,
      timeWell: 100,
      bestStreak: 2,
      bestStreakMs: 6000
    })
  })

  it('is empty for a session of bad attempts', () => {
    const summary = summarizeSession([timed('bad', 3000), timed('needs-work', 3000)])

    expect(summary).toMatchObject({ cleanRate: 0, timeWell: 0, bestStreak: 0, bestStreakMs: 0 })
  })

  it('weighs the time of each attempt, not only how many there were', () => {
    // 1 good attempt out of 3, but it was the long one: 6 s of 10 s.
    const summary = summarizeSession([
      timed('bad', 2000),
      timed('good', 6000),
      timed('needs-work', 2000)
    ])

    expect(summary).toMatchObject({ cleanRate: 33, timeWell: 60 })
  })

  it('finds the longest run of good attempts, whatever its place', () => {
    const summary = summarizeSession([
      timed('good', 1000),
      timed('bad', 1000),
      timed('good', 2000),
      timed('good', 3000),
      timed('needs-work', 1000),
      timed('good', 1000)
    ])

    expect(summary).toMatchObject({ bestStreak: 2, bestStreakMs: 5000 })
  })

  it('ends a run at an attempt that could not be judged, since nobody checked it', () => {
    const summary = summarizeSession([
      timed('good', 1000),
      timed('unknown', 1000),
      timed('good', 1000)
    ])

    expect(summary).toMatchObject({ bestStreak: 1, bestStreakMs: 1000, judged: 2 })
  })
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

describe('buildSessionDigest', () => {
  it('has nothing to say about a session without repetitions', () => {
    expect(buildSessionDigest('squat', 1000, 60_000, [])).toBeNull()
  })

  it('is made of counts, the score and the names of the failed rules', () => {
    const results = [rep('good'), rep('needs-work', ['torso']), rep('bad', ['depth', 'torso'])]

    expect(buildSessionDigest('squat', 1000, 60_400, results)).toEqual({
      skillId: 'squat',
      startedAt: 1000,
      durationSeconds: 60,
      repCount: 3,
      goodCount: 1,
      needsWorkCount: 1,
      badCount: 1,
      score: 50,
      errors: [
        { ruleId: 'torso', count: 2 },
        { ruleId: 'depth', count: 1 }
      ]
    })
  })

  it('adds the unit and the measures that the skill declares, and nothing else', () => {
    const results = [timed('good', 6000), timed('good', 6000), timed('bad', 3000)]
    const progress: SkillConfig['progress'] = {
      unit: 'holds',
      measures: ['timeWell', 'bestStreak']
    }

    expect(buildSessionDigest('guitar_posture', 1, 15_000, results, progress)).toMatchObject({
      unit: 'holds',
      timeWell: 80,
      bestStreakSeconds: 12
    })
    expect(buildSessionDigest('guitar_posture', 1, 15_000, results, progress)).not.toHaveProperty(
      'cleanRate'
    )
  })

  it('sends only what a skill without progress always sent', () => {
    const digest = buildSessionDigest('squat', 1, 1000, [rep('good')])

    expect(Object.keys(digest ?? {})).not.toContain('unit')
    expect(digest).not.toHaveProperty('timeWell')
  })

  it('goes through the schema that guards what is sent to the AI', () => {
    const results = [timed('good', 6000), timed('bad', 3000)]
    const digest = buildSessionDigest('guitar_posture', 1, 9000, results, {
      unit: 'holds',
      measures: ['cleanRate', 'timeWell', 'bestStreak']
    })

    expect(sessionDigestSchema.safeParse(digest).success).toBe(true)
  })

  it('carries no text of the rules, only their names', () => {
    const digest = buildSessionDigest('squat', 1, 1000, [rep('bad', ['depth'])])

    expect(JSON.stringify(digest)).not.toContain('corrige')
  })
})
