import { describe, expect, it } from 'vitest'
import { sessionNumbers, type Attempt } from '@renderer/engine/sessionSummary'
import { measureRows, unjudgedCount } from './summaryProgress'

const good = (durationMs = 5000): Attempt => ({ quality: 'good', durationMs })
const bad = (durationMs = 5000): Attempt => ({ quality: 'bad', durationMs })

describe('measureRows', () => {
  const today = sessionNumbers([good(6000), good(6000), bad(3000)])
  const before = sessionNumbers([good(2000), bad(6000)])

  it('has no rows when the skill declares no measures', () => {
    expect(measureRows(today, before, [])).toEqual([])
  })

  it('shows the measures of the skill in its own terms, with no comparison', () => {
    const rows = measureRows(today, null, ['timeWell', 'bestStreak', 'cleanRate'])

    expect(rows).toEqual([
      { label: 'summary.measure.timeWell', value: '80 %', before: null, trend: null },
      { label: 'summary.measure.bestStreak', value: '12 s', before: null, trend: null },
      { label: 'summary.measure.cleanRate', value: '67 %', before: null, trend: null }
    ])
  })

  it('adds the previous session and how it changed when the skill asks for it', () => {
    const rows = measureRows(today, before, ['bestStreak', 'vsPrevious'])

    expect(rows).toEqual([
      {
        label: 'summary.measure.bestStreak',
        value: '12 s',
        before: '2 s',
        trend: 'better'
      }
    ])
  })

  it('shows today alone on the first session, even when the skill compares', () => {
    const rows = measureRows(today, null, ['timeWell', 'vsPrevious'])

    expect(rows).toEqual([
      { label: 'summary.measure.timeWell', value: '80 %', before: null, trend: null }
    ])
  })

  it('leaves out a measure that could not be worked out', () => {
    const unjudged = sessionNumbers([{ quality: 'unknown', durationMs: 4000 }])

    expect(measureRows(unjudged, null, ['cleanRate', 'bestStreak'])).toEqual([])
  })
})

describe('unjudgedCount', () => {
  it('counts the attempts that could not be judged', () => {
    expect(unjudgedCount(['good', 'unknown', 'bad', 'unknown'])).toBe(2)
    expect(unjudgedCount([])).toBe(0)
  })
})
