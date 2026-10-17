import { describe, expect, it } from 'vitest'
import { estimateBpm, offBeatMs, OnsetDetector } from './rhythm'
import { clickTrack, levelSeries } from './syntheticSound'

function onsetsOf(signal: Float32Array): number[] {
  const detector = new OnsetDetector()
  return levelSeries(signal).flatMap(({ timestampMs, levelDb }) => {
    const onset = detector.update(timestampMs, levelDb)
    return onset === null ? [] : [onset]
  })
}

describe('OnsetDetector', () => {
  it('finds one note for every click', () => {
    expect(onsetsOf(clickTrack(100, 8))).toHaveLength(8)
  })

  it('finds them close to where they really are', () => {
    // The clicks are at 200, 800, 1400 ms... and a reading covers the 43 ms before its time.
    const found = onsetsOf(clickTrack(100, 4))

    found.forEach((time, index) => {
      expect(Math.abs(time - (200 + index * 600))).toBeLessThan(90)
    })
  })

  it('finds nothing in silence', () => {
    expect(onsetsOf(new Float32Array(48_000))).toEqual([])
  })

  it('ignores a rise that is only the noise of the room', () => {
    const detector = new OnsetDetector()

    expect(detector.update(0, -80)).toBeNull()
    expect(detector.update(33, -62)).toBeNull()
  })

  it('counts a note that rings as one, not as every reading that is still loud', () => {
    const detector = new OnsetDetector()
    const levels = [-70, -70, -20, -18, -19, -21, -25, -30]

    const found = levels.flatMap((level, index) => detector.update(index * 33, level) ?? [])

    expect(found).toHaveLength(1)
  })

  it('does not count two notes closer than the minimum gap', () => {
    const detector = new OnsetDetector({ riseDb: 8, floorDb: -50, minGapMs: 120, lookBack: 1 })

    const found = [-70, -20, -70, -20].flatMap(
      (level, index) => detector.update(index * 33, level) ?? []
    )

    expect(found).toHaveLength(1)
  })

  it('starts over when reset', () => {
    const detector = new OnsetDetector()
    detector.update(0, -70)
    detector.update(33, -20)

    detector.reset()

    expect(detector.update(40, -20)).toBeNull()
  })
})

describe('estimateBpm', () => {
  it.each([60, 80, 100, 120, 160, 200])('finds %i bpm within 3 from a metronome', (bpm) => {
    const found = estimateBpm(onsetsOf(clickTrack(bpm, 12)))

    expect(found).not.toBeNull()
    expect(Math.abs((found ?? 0) - bpm)).toBeLessThanOrEqual(3)
  })

  it('finds the pace of a player who is a little uneven, within 3 bpm', () => {
    const found = estimateBpm(onsetsOf(clickTrack(100, 16, { jitterMs: 30 })))

    expect(Math.abs((found ?? 0) - 100)).toBeLessThanOrEqual(3)
  })

  it('does not let one note that came very late spoil the pace', () => {
    const found = estimateBpm([0, 600, 1200, 1800, 3000, 3600, 4200])

    expect(found).toBeCloseTo(100, 0)
  })

  it('needs three notes at least', () => {
    expect(estimateBpm([])).toBeNull()
    expect(estimateBpm([0])).toBeNull()
    expect(estimateBpm([0, 600])).toBeNull()
    expect(estimateBpm([0, 600, 1200])).toBeCloseTo(100)
  })

  it('gives nothing for a pace that is not music', () => {
    expect(estimateBpm([0, 10, 20, 30])).toBeNull()
    expect(estimateBpm([0, 5000, 10_000, 15_000])).toBeNull()
  })
})

describe('offBeatMs', () => {
  it('is zero on the beat and the sign says late or early', () => {
    expect(offBeatMs(1200, 0, 600)).toBeCloseTo(0)
    expect(offBeatMs(1250, 0, 600)).toBeCloseTo(50)
    expect(offBeatMs(1150, 0, 600)).toBeCloseTo(-50)
  })

  it('counts from the nearest beat, not from the first', () => {
    expect(offBeatMs(6050, 0, 600)).toBeCloseTo(50)
  })
})
