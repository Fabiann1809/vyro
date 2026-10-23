import { describe, expect, it } from 'vitest'
import { compareWithPrevious } from './sessionComparison'
import { sessionNumbers, type Attempt } from './sessionSummary'

const good = (durationMs = 5000): Attempt => ({ quality: 'good', durationMs })
const bad = (durationMs = 5000): Attempt => ({ quality: 'bad', durationMs })

describe('compareWithPrevious', () => {
  it('has nothing to compare on the first session', () => {
    expect(compareWithPrevious(sessionNumbers([good()]), null, ['cleanRate'])).toEqual([])
  })

  it('says the score improved', () => {
    const changes = compareWithPrevious(
      sessionNumbers([good(), good()]),
      sessionNumbers([good(), bad()]),
      []
    )

    expect(changes).toEqual([{ what: 'score', today: 100, before: 50, trend: 'better' }])
  })

  it('says it got worse, and that it stayed the same inside the margin', () => {
    const worse = compareWithPrevious(sessionNumbers([bad()]), sessionNumbers([good()]), [])
    expect(worse[0]).toMatchObject({ what: 'score', trend: 'worse' })

    const attempts = [good(), good(), bad()]
    const same = compareWithPrevious(sessionNumbers(attempts), sessionNumbers(attempts), [])
    expect(same[0]).toMatchObject({ trend: 'same' })
  })

  it('compares the streak by how long it lasted', () => {
    const today = sessionNumbers([good(), good(), bad(), good(2000)])
    const before = sessionNumbers([good(), bad(), good(3000)])

    const changes = compareWithPrevious(today, before, ['bestStreak'])

    expect(changes.find((change) => change.what === 'bestStreak')).toEqual({
      what: 'bestStreak',
      today: 10000,
      before: 5000,
      trend: 'better'
    })
  })

  it('only compares the measures that the skill shows, besides the score', () => {
    const today = sessionNumbers([good(), bad()])
    const before = sessionNumbers([good(), good()])

    expect(compareWithPrevious(today, before, []).map((change) => change.what)).toEqual(['score'])
    expect(
      compareWithPrevious(today, before, ['timeWell', 'cleanRate', 'vsPrevious']).map(
        (change) => change.what
      )
    ).toEqual(['score', 'timeWell', 'cleanRate'])
  })

  it('leaves out what could not be worked out in one of the sessions', () => {
    const unjudged = sessionNumbers([{ quality: 'unknown', durationMs: 5000 }])

    expect(compareWithPrevious(sessionNumbers([good()]), unjudged, ['cleanRate'])).toEqual([])
    expect(compareWithPrevious(unjudged, sessionNumbers([good()]), ['bestStreak'])).toEqual([])
  })
})
