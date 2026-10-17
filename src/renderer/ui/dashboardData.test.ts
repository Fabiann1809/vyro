import { describe, expect, it } from 'vitest'
import { bundledSkills } from '@renderer/skills'
import type { RepQuality, SessionDetail, SessionRow } from '@shared/sessions'
import {
  channelSeries,
  daysAgo,
  errorRows,
  fatigueStory,
  heatmapDays,
  repQualities,
  scorePoints,
  scoreStory,
  streakLength,
  type ScoreStory
} from './dashboardData'

// Noon of a day in October 2026, by the clock of whoever runs the tests.
const NOW = new Date(2026, 9, 17, 12).getTime()
const at = (ago: number, hour = 18): number => new Date(2026, 9, 17 - ago, hour).getTime()

let nextId = 1
function session(ago: number, score: number | null, skillId = 'squat', hour = 18): SessionRow {
  return {
    id: nextId++,
    skillId,
    startedAt: at(ago, hour),
    durationMs: 60_000,
    score,
    repCount: 10,
    goodCount: 8,
    needsWorkCount: 1,
    badCount: 1
  }
}

describe('daysAgo', () => {
  it('counts the days of the calendar, not blocks of 24 hours', () => {
    expect(daysAgo(at(0, 8), NOW)).toBe(0)
    expect(daysAgo(new Date(2026, 9, 16, 23, 59).getTime(), NOW)).toBe(1)
    expect(daysAgo(at(30), NOW)).toBe(30)
  })
})

describe('streakLength', () => {
  it('counts the days in a row up to today', () => {
    expect(streakLength([session(0, 70), session(1, 70), session(2, 70)], NOW)).toBe(3)
  })

  it('keeps the streak alive while today is not over', () => {
    expect(streakLength([session(1, 70), session(2, 70)], NOW)).toBe(2)
  })

  it('is broken by a day with nothing', () => {
    expect(streakLength([session(0, 70), session(2, 70)], NOW)).toBe(1)
    expect(streakLength([session(2, 70), session(3, 70)], NOW)).toBe(0)
  })

  it('counts a day once however many sessions it had', () => {
    expect(streakLength([session(0, 70, 'squat', 9), session(0, 80, 'squat', 18)], NOW)).toBe(1)
  })

  it('is zero without sessions', () => {
    expect(streakLength([], NOW)).toBe(0)
  })
})

describe('scorePoints', () => {
  const sessions = [
    session(1, 71),
    session(9, 65),
    session(26, 55),
    session(3, null),
    session(40, 50)
  ]

  it('orders the scores from the oldest to the newest and leaves out sessions with none', () => {
    expect(scorePoints(sessions, 'all', NOW).map((point) => point.score)).toEqual([50, 55, 65, 71])
  })

  it('keeps only the days asked for', () => {
    expect(scorePoints(sessions, '7', NOW).map((point) => point.score)).toEqual([71])
    expect(scorePoints(sessions, '30', NOW).map((point) => point.score)).toEqual([55, 65, 71])
  })

  it('has nothing for no sessions', () => {
    expect(scorePoints([], 'all', NOW)).toEqual([])
  })
})

describe('scoreStory', () => {
  const story = (...scores: number[]): ScoreStory =>
    scoreStory(scores.map((score, index) => ({ sessionId: index, startedAt: index, score })))

  it('says there is nothing, or only one', () => {
    expect(story()).toEqual({ kind: 'none' })
    expect(story(70)).toEqual({ kind: 'one', score: 70 })
  })

  it('says whether the scores went up, down or stayed', () => {
    expect(story(55, 60, 78)).toEqual({ kind: 'rise', first: 55, last: 78, delta: 23, count: 3 })
    expect(story(80, 60)).toMatchObject({ kind: 'drop', delta: 20 })
    expect(story(70, 90, 70)).toMatchObject({ kind: 'flat', delta: 0 })
  })
})

describe('heatmapDays', () => {
  it('has a square for each day, from the oldest to today', () => {
    const days = heatmapDays([], NOW)

    expect(days).toHaveLength(84)
    expect(daysAgo(days[0]!.date, NOW)).toBe(83)
    expect(daysAgo(days[83]!.date, NOW)).toBe(0)
    expect(days.every((day) => day.level === 0)).toBe(true)
  })

  it('is darker the better the day', () => {
    const days = heatmapDays(
      [session(0, 90), session(1, 70), session(2, 40), session(3, null)],
      NOW
    )
    const level = (ago: number): number => days[83 - ago]!.level

    expect([level(0), level(1), level(2), level(3), level(4)]).toEqual([3, 2, 1, 1, 0])
  })

  it('shows the best score of a day with several sessions', () => {
    const days = heatmapDays([session(0, 60, 'squat', 8), session(0, 85, 'squat', 19)], NOW)

    expect(days[83]).toMatchObject({ score: 85, sessions: 2, level: 3 })
  })

  it('marks the days of the streak', () => {
    const days = heatmapDays([session(0, 70), session(1, 70), session(3, 70)], NOW)

    expect(days.slice(-4).map((day) => day.streak)).toEqual([false, false, true, true])
  })
})

const detail = (
  ago: number,
  reps: Array<{ quality: RepQuality; failed?: string[] }>,
  skillId = 'squat'
): SessionDetail => ({
  ...session(ago, 70, skillId),
  reps: reps.map((rep, index) => ({
    id: index + 1,
    index: index + 1,
    quality: rep.quality,
    durationMs: 2000,
    failedRuleIds: rep.failed ?? []
  }))
})

describe('repQualities', () => {
  it('lists the repetitions in order and leaves out the ones that could not be judged', () => {
    const reps = detail(0, [
      { quality: 'good' },
      { quality: 'unknown' },
      { quality: 'needs-work' },
      { quality: 'bad' }
    ])

    expect(repQualities(reps)).toEqual(['good', 'warn', 'bad'])
  })
})

describe('fatigueStory', () => {
  it('needs a few repetitions to say anything', () => {
    expect(fatigueStory(['good', 'bad', 'good'])).toEqual({ kind: 'too-few' })
  })

  it('notices a technique that wears out', () => {
    expect(fatigueStory(['good', 'good', 'good', 'bad', 'warn', 'bad'])).toEqual({
      kind: 'wears-out',
      firstFailures: 0,
      lastFailures: 3,
      half: 3
    })
  })

  it('says steady when the end is no worse than the start', () => {
    expect(fatigueStory(['warn', 'good', 'good', 'good', 'good', 'warn'])).toEqual({
      kind: 'steady'
    })
  })
})

const squat = bundledSkills.skills.find((skill) => skill.id === 'squat')!
const firstRule = squat.rules[0]!.id
const secondRule = squat.rules[1]!.id

describe('errorRows', () => {
  const skills = bundledSkills.skills

  it('puts the rule failed most first, with how often', () => {
    const rows = errorRows(
      [
        detail(1, [
          { quality: 'bad', failed: [firstRule] },
          { quality: 'bad', failed: [firstRule] }
        ]),
        detail(2, [{ quality: 'needs-work', failed: [secondRule] }])
      ],
      skills,
      NOW
    )

    expect(rows.map((row) => [row.ruleId, row.count])).toEqual([
      [firstRule, 2],
      [secondRule, 1]
    ])
    expect(rows[0]).toMatchObject({ skillId: 'squat', channel: 'body' })
  })

  it('compares with the four weeks before', () => {
    const rows = errorRows(
      [
        detail(2, [{ quality: 'bad', failed: [firstRule] }]),
        detail(40, [
          { quality: 'bad', failed: [firstRule] },
          { quality: 'bad', failed: [firstRule] }
        ]),
        detail(80, [{ quality: 'bad', failed: [firstRule] }])
      ],
      skills,
      NOW
    )

    expect(rows[0]).toMatchObject({ count: 1, before: 2 })
  })

  it('leaves out what was only failed before, and rules that no longer exist', () => {
    const rows = errorRows(
      [
        detail(40, [{ quality: 'bad', failed: [firstRule] }]),
        detail(1, [{ quality: 'bad', failed: ['gone'] }])
      ],
      skills,
      NOW
    )

    expect(rows).toEqual([])
  })

  it('shows at most five', () => {
    const rules = bundledSkills.skills.find((skill) => skill.id === 'guitar_posture')!.rules
    const rows = errorRows(
      [
        detail(
          1,
          rules.map((rule) => ({ quality: 'bad' as const, failed: [rule.id] })),
          'guitar_posture'
        )
      ],
      skills,
      NOW
    )

    expect(rows.length).toBeLessThanOrEqual(5)
  })
})

describe('channelSeries', () => {
  const skills = bundledSkills.skills
  const guitar = skills.find((skill) => skill.id === 'guitar_posture')!
  const bodyRule = guitar.rules.find((rule) => rule.id === 'straight_back')!.id
  const audioRule = guitar.rules.find((rule) => rule.id === 'out_of_tune')!.id

  it('counts how often each channel failed, session by session, oldest first', () => {
    const series = channelSeries(
      [
        detail(1, [{ quality: 'bad', failed: [bodyRule] }, { quality: 'good' }], 'guitar_posture'),
        detail(
          5,
          [
            { quality: 'bad', failed: [bodyRule, audioRule] },
            { quality: 'bad', failed: [bodyRule] }
          ],
          'guitar_posture'
        )
      ],
      skills
    )

    expect(series.find((item) => item.channel === 'body')?.rates).toEqual([100, 50])
    expect(series.find((item) => item.channel === 'audio')?.rates).toEqual([50, 0])
    expect(series.find((item) => item.channel === 'hands')?.rates).toEqual([0, 0])
  })

  it('only counts a channel in the sessions of skills that use it', () => {
    const series = channelSeries([detail(1, [{ quality: 'good' }])], skills)

    expect(series.map((item) => item.channel)).toEqual(['body'])
  })

  it('skips sessions where nothing could be judged', () => {
    expect(channelSeries([detail(1, [{ quality: 'unknown' }])], skills)).toEqual([])
  })

  it('keeps the latest nine sessions', () => {
    const many = Array.from({ length: 12 }, (_, index) => detail(12 - index, [{ quality: 'good' }]))

    expect(channelSeries(many, skills)[0]?.rates).toHaveLength(9)
  })
})
