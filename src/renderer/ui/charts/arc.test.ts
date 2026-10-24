import { describe, expect, it } from 'vitest'
import { angleOf, arcPath, pointAt, tickPath } from './arc'

describe('angleOf', () => {
  const scale = { min: 0, max: 100 }

  it('puts the minimum on the left, the middle at the top and the maximum on the right', () => {
    expect(angleOf(0, scale)).toBe(180)
    expect(angleOf(50, scale)).toBe(90)
    expect(angleOf(100, scale)).toBe(0)
  })

  it('keeps a value beyond the scale at its end', () => {
    expect(angleOf(-20, scale)).toBe(180)
    expect(angleOf(300, scale)).toBe(0)
  })
})

describe('pointAt', () => {
  it('finds the right, the top and the left of the circle', () => {
    const [rx, ry] = pointAt(100, 100, 50, 0)
    const [tx, ty] = pointAt(100, 100, 50, 90)
    const [lx, ly] = pointAt(100, 100, 50, 180)

    expect([rx, ry]).toEqual([150, 100])
    expect(tx).toBeCloseTo(100)
    expect(ty).toBeCloseTo(50)
    expect(lx).toBeCloseTo(50)
    expect(ly).toBeCloseTo(100)
  })
})

describe('arcPath', () => {
  it('starts where the first angle is and ends where the second is', () => {
    expect(arcPath(100, 100, 50, 180, 0)).toBe('M50 100 A50 50 0 0 1 150 100')
  })
})

describe('tickPath', () => {
  it('draws one mark for each tick', () => {
    expect(tickPath(100, 100, 40, 50, 5).split('M').filter(Boolean)).toHaveLength(5)
  })
})
