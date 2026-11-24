import { describe, expect, it } from 'vitest'
import { summarizeSession } from './sessionSummary'
import type { RepQuality, RepResult } from './repEvaluator'
import { settleTuning } from './tuningResults'

const flat = {
  ruleId: 'too_flat',
  severity: 'high',
  status: 'failed',
  message: { es: 'baja', en: 'flat' }
}

const pluck = (quality: RepQuality): RepResult => ({
  repIndex: 1,
  quality,
  durationMs: 900,
  outcomes: [],
  failed: quality === 'bad' ? [flat as never] : []
})

describe('settleTuning', () => {
  it('scores each tuned string once, however many plucks it took', () => {
    const byString = new Map([
      [0, [pluck('bad'), pluck('bad'), pluck('good')]],
      [1, [pluck('bad'), pluck('bad'), pluck('bad'), pluck('bad')]]
    ])

    const results = settleTuning(byString, new Set([0, 1]))

    expect(results.map((result) => result.quality)).toEqual(['good', 'good'])
    expect(summarizeSession(results).score).toBe(100)
  })

  it('keeps what failed on the way, once for each string, to tell what to correct', () => {
    const byString = new Map([[0, [pluck('bad'), pluck('bad'), pluck('good')]]])

    const [result] = settleTuning(byString, new Set([0]))

    expect(result?.failed.map((outcome) => outcome.ruleId)).toEqual(['too_flat'])
  })

  it('counts a string that was left untuned as its last pluck was judged', () => {
    const byString = new Map([
      [0, [pluck('good')]],
      [1, [pluck('good'), pluck('bad')]]
    ])

    const results = settleTuning(byString, new Set([0]))

    expect(results.map((result) => result.quality)).toEqual(['good', 'bad'])
    expect(summarizeSession(results).score).toBe(50)
  })

  it('counts a tuned string even when no pluck was judged, and skips one never tried', () => {
    const byString = new Map<number, RepResult[]>([
      [0, []],
      [1, []]
    ])

    const results = settleTuning(byString, new Set([0]))

    expect(results).toHaveLength(1)
    expect(results[0]?.quality).toBe('good')
  })

  it('numbers the strings in the order they were tried', () => {
    const byString = new Map([
      [3, [pluck('good')]],
      [1, [pluck('good')]]
    ])

    expect(settleTuning(byString, new Set([1, 3])).map((result) => result.repIndex)).toEqual([1, 2])
  })
})
