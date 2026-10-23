import { describe, expect, it } from 'vitest'
import { PROGRESS_UNITS } from '@shared/skill/progress'
import type { RepQuality, SessionDetail } from '@shared/sessions'
import en from '@renderer/i18n/en.json'
import es from '@renderer/i18n/es.json'
import { measureSeries, QUALITY_WORDS } from './dashboardUnits'

const session = (id: number, reps: Array<[RepQuality, number]>): SessionDetail => ({
  id,
  skillId: 'guitar_posture',
  startedAt: id * 1000,
  durationMs: 60_000,
  score: 50,
  repCount: reps.length,
  goodCount: 0,
  needsWorkCount: 0,
  badCount: 0,
  reps: reps.map(([quality, durationMs], index) => ({
    id: index + 1,
    index: index + 1,
    quality,
    durationMs,
    failedRuleIds: []
  }))
})

describe('QUALITY_WORDS', () => {
  it('has the texts of the quality card for every unit', () => {
    for (const unit of PROGRESS_UNITS) {
      expect(Object.keys(QUALITY_WORDS[unit])).toHaveLength(5)
    }
  })

  it('points every unit at texts that exist in both languages', () => {
    for (const unit of PROGRESS_UNITS) {
      for (const key of Object.values(QUALITY_WORDS[unit])) {
        expect(es).toHaveProperty([key])
        expect(en).toHaveProperty([key])
      }
    }
  })
})

describe('measureSeries', () => {
  const sessions = [
    session(3, [
      ['good', 6000],
      ['good', 6000]
    ]),
    session(1, [
      ['bad', 3000],
      ['good', 3000]
    ]),
    session(2, [
      ['good', 5000],
      ['bad', 5000]
    ])
  ]

  it('follows each declared measure from the oldest session, in percent and seconds', () => {
    expect(measureSeries(sessions, ['timeWell', 'bestStreak'])).toEqual([
      { measure: 'timeWell', values: [50, 50, 100] },
      { measure: 'bestStreak', values: [3, 5, 12] }
    ])
  })

  it('skips vsPrevious, which is a comparison and not a series', () => {
    expect(measureSeries(sessions, ['vsPrevious'])).toEqual([])
  })

  it('leaves a session out of a series where its measure could not be worked out', () => {
    const unjudged = session(4, [['unknown', 4000]])

    expect(measureSeries([...sessions, unjudged], ['cleanRate'])[0]?.values).toEqual([50, 50, 100])
  })

  it('keeps only the latest sessions', () => {
    const many = Array.from({ length: 12 }, (_, index) => session(index + 1, [['good', 2000]]))

    expect(measureSeries(many, ['cleanRate'])[0]?.values).toHaveLength(9)
  })
})
