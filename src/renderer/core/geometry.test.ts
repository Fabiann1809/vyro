import { describe, expect, it } from 'vitest'
import { angleAt, distance, tiltFromVertical, toPixels } from './geometry'

describe('distance', () => {
  it('measures a 3-4-5 triangle', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('is zero for the same point', () => {
    expect(distance({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0)
  })
})

describe('toPixels', () => {
  it('scales normalized coordinates to the frame size', () => {
    expect(toPixels({ x: 0.5, y: 0.25 }, 1280, 720)).toEqual({ x: 640, y: 180 })
  })
})

describe('angleAt', () => {
  const vertex = { x: 0, y: 0 }

  it('measures a right angle', () => {
    expect(angleAt({ x: 1, y: 0 }, vertex, { x: 0, y: 1 })).toBeCloseTo(90)
  })

  it('measures a straight leg as 180 degrees', () => {
    expect(angleAt({ x: -1, y: 0 }, vertex, { x: 1, y: 0 })).toBeCloseTo(180)
  })

  it('measures a fully folded joint as 0 degrees', () => {
    expect(angleAt({ x: 1, y: 0 }, vertex, { x: 2, y: 0 })).toBeCloseTo(0)
  })

  it('measures 45 degrees', () => {
    expect(angleAt({ x: 1, y: 0 }, vertex, { x: 1, y: 1 })).toBeCloseTo(45)
  })

  it('does not depend on the order of the two ends', () => {
    const a = { x: 3, y: -1 }
    const b = { x: -2, y: 4 }
    expect(angleAt(a, vertex, b)).toBeCloseTo(angleAt(b, vertex, a) ?? NaN)
  })

  it('does not depend on where the joint is in the image', () => {
    const shifted = { x: 10, y: 20 }
    const angle = angleAt({ x: 11, y: 20 }, shifted, { x: 10, y: 21 })
    expect(angle).toBeCloseTo(90)
  })

  it('returns null when an end coincides with the vertex', () => {
    expect(angleAt(vertex, vertex, { x: 1, y: 0 })).toBeNull()
    expect(angleAt({ x: 1, y: 0 }, vertex, vertex)).toBeNull()
  })

  it('must be measured in pixels: normalized values distort a 16:9 frame', () => {
    // In the picture, vertex→a is horizontal and vertex→b is a true 45 degree diagonal
    // (100 px right and 100 px down), written as normalized coordinates of a 1280x720 frame.
    const vertex = { x: 0.5, y: 0.5 }
    const a = { x: 0.5 + 100 / 1280, y: 0.5 }
    const b = { x: 0.5 + 100 / 1280, y: 0.5 + 100 / 720 }

    const inPixels = angleAt(
      toPixels(a, 1280, 720),
      toPixels(vertex, 1280, 720),
      toPixels(b, 1280, 720)
    )
    const raw = angleAt(a, vertex, b)

    expect(inPixels).toBeCloseTo(45)
    expect(raw).not.toBeCloseTo(45, 0)
  })
})

describe('tiltFromVertical', () => {
  const origin = { x: 0, y: 0 }

  it('is 0 when the second point is straight above', () => {
    expect(tiltFromVertical(origin, { x: 0, y: -5 })).toBeCloseTo(0)
  })

  it('is 90 when the segment is level, to either side', () => {
    expect(tiltFromVertical(origin, { x: 5, y: 0 })).toBeCloseTo(90)
    expect(tiltFromVertical(origin, { x: -5, y: 0 })).toBeCloseTo(90)
  })

  it('is 180 when the second point is straight below', () => {
    expect(tiltFromVertical(origin, { x: 0, y: 5 })).toBeCloseTo(180)
  })

  it('is 45 for a diagonal leaning to either side', () => {
    expect(tiltFromVertical(origin, { x: 3, y: -3 })).toBeCloseTo(45)
    expect(tiltFromVertical(origin, { x: -3, y: -3 })).toBeCloseTo(45)
  })

  it('returns null when both points coincide', () => {
    expect(tiltFromVertical(origin, origin)).toBeNull()
  })
})
