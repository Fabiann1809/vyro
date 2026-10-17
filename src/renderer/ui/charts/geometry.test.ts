import { describe, expect, it } from 'vitest'
import {
  areaPath,
  bestIndex,
  linePath,
  pathLength,
  percentOn,
  ringDash,
  seriesPoints,
  share,
  ticks,
  trend,
  yOf,
  type Frame
} from './geometry'

const frame: Frame = { width: 200, height: 100, padX: 10, padY: 10 }
const range = { min: 0, max: 100 }

describe('yOf', () => {
  it('puts the maximum at the top and the minimum at the bottom of the drawing area', () => {
    expect(yOf(100, frame, range)).toBe(10)
    expect(yOf(0, frame, range)).toBe(90)
    expect(yOf(50, frame, range)).toBe(50)
  })

  it('does not divide by zero on a flat range', () => {
    expect(Number.isFinite(yOf(5, frame, { min: 5, max: 5 }))).toBe(true)
  })
})

describe('seriesPoints', () => {
  it('spreads the points evenly from edge to edge', () => {
    const points = seriesPoints([0, 50, 100], frame, range)

    expect(points.map((point) => point.x)).toEqual([10, 100, 190])
    expect(points.map((point) => point.y)).toEqual([90, 50, 10])
  })

  it('puts a single point in the middle', () => {
    expect(seriesPoints([40], frame, range)[0]?.x).toBe(100)
  })

  it('gives nothing for no values', () => {
    expect(seriesPoints([], frame, range)).toEqual([])
  })
})

describe('paths', () => {
  const points = seriesPoints([0, 100], frame, range)

  it('draws a line through the points', () => {
    expect(linePath(points)).toBe('M10 90 L190 10')
  })

  it('closes the area down to the bottom', () => {
    expect(areaPath(points, 100)).toBe('M10 90 L190 10 L190 100 L10 100 Z')
  })

  it('has no area without points', () => {
    expect(areaPath([], 100)).toBe('')
  })

  it('measures the length of the line, a little over', () => {
    expect(
      pathLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 }
      ])
    ).toBe(7)
    expect(pathLength([])).toBe(2)
  })
})

describe('trend', () => {
  it('follows a rising series', () => {
    const line = trend([10, 20, 30])

    expect(line?.first).toBeCloseTo(10)
    expect(line?.last).toBeCloseTo(30)
  })

  it('is flat for equal values', () => {
    const line = trend([50, 50, 50, 50])

    expect(line?.first).toBeCloseTo(50)
    expect(line?.last).toBeCloseTo(50)
  })

  it('smooths out the ups and downs', () => {
    const line = trend([10, 30, 20, 40])

    expect(line!.last).toBeGreaterThan(line!.first)
  })

  it('has none with fewer than two values', () => {
    expect(trend([])).toBeNull()
    expect(trend([5])).toBeNull()
  })
})

describe('bestIndex', () => {
  it('finds the highest value, the first of several', () => {
    expect(bestIndex([3, 9, 2, 9])).toBe(1)
  })

  it('says -1 when there is none', () => {
    expect(bestIndex([])).toBe(-1)
  })
})

describe('small helpers', () => {
  it('gives the ends and the middle of a range as ticks', () => {
    expect(ticks({ min: 40, max: 100 })).toEqual([40, 70, 100])
  })

  it('keeps a share between 0 and 1', () => {
    expect(share(3, 4)).toBe(0.75)
    expect(share(9, 4)).toBe(1)
    expect(share(1, 0)).toBe(0)
  })

  it('sizes the arc of a ring', () => {
    const half = ringDash(50, 50)

    expect(half.length).toBeCloseTo(2 * Math.PI * 50)
    expect(half.offset).toBeCloseTo(half.length / 2)
    expect(ringDash(50, 150).offset).toBeCloseTo(0)
    expect(ringDash(50, -5).offset).toBeCloseTo(half.length)
  })

  it('places a value on a scale, and keeps it inside', () => {
    expect(percentOn(0, { min: -50, max: 50 })).toBe(50)
    expect(percentOn(-80, { min: -50, max: 50 })).toBe(0)
    expect(percentOn(80, { min: -50, max: 50 })).toBe(100)
  })
})
