import { describe, expect, it } from 'vitest'
import type { SessionRow } from '@shared/sessions'
import { buildProgressSeries } from './progressSeries'

const row = (
  id: number,
  startedAt: number,
  goodCount: number,
  score: number | null
): SessionRow => ({
  id,
  skillId: 'squat',
  startedAt,
  durationMs: 60_000,
  score,
  repCount: 10,
  goodCount,
  needsWorkCount: 0,
  badCount: 0
})

describe('buildProgressSeries', () => {
  it('is empty without sessions', () => {
    expect(buildProgressSeries([])).toEqual([])
  })

  it('orders the sessions from the oldest to the newest', () => {
    const series = buildProgressSeries([
      row(3, 3000, 8, 80),
      row(1, 1000, 4, 40),
      row(2, 2000, 6, 60)
    ])

    expect(series.map((point) => point.startedAt)).toEqual([1000, 2000, 3000])
  })

  it('keeps the good repetitions and the score of each session', () => {
    expect(buildProgressSeries([row(1, 1000, 4, null)])).toEqual([
      { sessionId: 1, startedAt: 1000, goodReps: 4, score: null }
    ])
  })

  it('keeps sessions that started at the same moment in the order they were saved', () => {
    const series = buildProgressSeries([row(2, 1000, 1, 10), row(1, 1000, 2, 20)])

    expect(series.map((point) => point.sessionId)).toEqual([1, 2])
  })
})
