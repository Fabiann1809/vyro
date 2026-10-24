import { describe, expect, it } from 'vitest'
import { smoothCurve } from './curve'

describe('smoothCurve', () => {
  it('has nothing to draw without points', () => {
    expect(smoothCurve([])).toEqual({ d: '', length: 0, reach: [] })
  })

  it('starts at the first point and goes through every other', () => {
    const { d } = smoothCurve([
      [0, 0],
      [100, 50],
      [200, 0]
    ])

    expect(d.startsWith('M0.0 0.0')).toBe(true)
    expect(d).toContain('100.0 50.0')
    expect(d.endsWith('200.0 0.0')).toBe(true)
  })

  it('measures a straight line as the distance between its ends', () => {
    const { length, reach } = smoothCurve([
      [0, 0],
      [60, 0],
      [120, 0]
    ])

    expect(length).toBeGreaterThanOrEqual(120)
    expect(length).toBeLessThanOrEqual(123)
    expect(reach[0]).toBe(0)
    expect(reach[1]).toBeCloseTo(60, 0)
    expect(reach[2]).toBeCloseTo(120, 0)
  })

  it('reaches the points in order along its length', () => {
    const { reach } = smoothCurve([
      [0, 0],
      [50, 80],
      [120, 10],
      [200, 90]
    ])

    expect(reach).toEqual([...reach].sort((a, b) => a - b))
    expect(reach).toHaveLength(4)
  })
})
