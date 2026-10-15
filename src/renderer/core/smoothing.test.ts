import { describe, expect, it } from 'vitest'
import type { Landmark } from './landmarks'
import { LandmarkSmoother } from './smoothing'

const FRAME_MS = 1000 / 30

// Deterministic pseudo-random numbers so the tests never flake.
function createNoise(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    const uniform = ((t ^ (t >>> 14)) >>> 0) / 4294967296
    return (uniform - 0.5) * 2
  }
}

function point(x: number, y = 0.5, visibility = 0.9): Landmark[] {
  return [{ x, y, z: 0, visibility }]
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
}

function firstX(landmarks: Landmark[] | null): number {
  return landmarks?.[0]?.x ?? NaN
}

describe('LandmarkSmoother', () => {
  it('returns the first frame unchanged', () => {
    const smoother = new LandmarkSmoother()

    expect(smoother.smooth(point(0.4), 0)).toEqual(point(0.4))
  })

  it('removes most of the jitter when the body is still', () => {
    const smoother = new LandmarkSmoother()
    const noise = createNoise(7)
    const raw: number[] = []
    const smoothed: number[] = []

    for (let frame = 0; frame < 120; frame++) {
      const x = 0.5 + noise() * 0.006
      raw.push(x)
      smoothed.push(firstX(smoother.smooth(point(x), frame * FRAME_MS)))
    }

    // Skip the first second while the filter settles.
    const rawJitter = standardDeviation(raw.slice(30))
    const smoothedJitter = standardDeviation(smoothed.slice(30))
    expect(smoothedJitter).toBeLessThan(rawJitter * 0.4)
  })

  it('follows a fast movement with almost no lag', () => {
    const smoother = new LandmarkSmoother()
    const speedPerSecond = 0.5
    let error = 0

    for (let frame = 0; frame < 60; frame++) {
      const timestampMs = frame * FRAME_MS
      const truth = 0.2 + (speedPerSecond * timestampMs) / 1000
      const smoothed = firstX(smoother.smooth(point(truth), timestampMs))
      if (frame >= 30) error = Math.max(error, Math.abs(smoothed - truth))
    }

    // Less than 1.5 % of the frame width behind the real position (about 19 px at 1280 px).
    expect(error).toBeLessThan(0.015)
  })

  it('reaches a new position quickly after a sudden jump', () => {
    const smoother = new LandmarkSmoother()
    for (let frame = 0; frame < 30; frame++) smoother.smooth(point(0.3), frame * FRAME_MS)

    let framesToSettle = 0
    for (let frame = 30; frame < 60; frame++) {
      framesToSettle++
      const x = firstX(smoother.smooth(point(0.6), frame * FRAME_MS))
      if (Math.abs(x - 0.6) < 0.03) break
    }

    // Within a fifth of a second at 30 fps.
    expect(framesToSettle).toBeLessThanOrEqual(6)
  })

  it('does not smooth visibility', () => {
    const smoother = new LandmarkSmoother()
    smoother.smooth(point(0.5, 0.5, 0.9), 0)

    expect(smoother.smooth(point(0.5, 0.5, 0.2), FRAME_MS)?.[0]?.visibility).toBe(0.2)
  })

  it('forgets the previous pose when the person leaves the frame', () => {
    const smoother = new LandmarkSmoother()
    smoother.smooth(point(0.1), 0)

    expect(smoother.smooth(null, FRAME_MS)).toBeNull()
    // Back in view somewhere else: no drag from the old position.
    expect(smoother.smooth(point(0.9), 2 * FRAME_MS)).toEqual(point(0.9))
  })

  it('ignores a frame whose timestamp does not advance', () => {
    const smoother = new LandmarkSmoother()
    smoother.smooth(point(0.5), 100)

    const repeated = smoother.smooth(point(0.7), 100)

    expect(firstX(repeated)).toBe(0.5)
  })

  it('smooths every point of the pose on its own', () => {
    const smoother = new LandmarkSmoother()
    const pose = (a: number, b: number): Landmark[] => [
      { x: a, y: 0.5, z: 0, visibility: 1 },
      { x: b, y: 0.5, z: 0, visibility: 1 }
    ]
    smoother.smooth(pose(0.2, 0.8), 0)

    const next = smoother.smooth(pose(0.2, 0.8), FRAME_MS)

    expect(next?.[0]?.x).toBeCloseTo(0.2)
    expect(next?.[1]?.x).toBeCloseTo(0.8)
  })
})
