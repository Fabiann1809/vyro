import { describe, expect, it } from 'vitest'
import { bubbleDiameter, packBubbles } from './bubbles'

describe('packBubbles', () => {
  it('puts a single bubble in the middle', () => {
    expect(packBubbles([100], 300, 200)).toEqual([{ x: 150, y: 100, r: 50 }])
  })

  it('never lets two bubbles overlap, nor leave the box', () => {
    const diameters = [128, 110, 96, 90, 84]
    const placed = packBubbles(diameters, 330, 236)

    expect(placed).toHaveLength(5)
    placed.forEach((bubble, index) => {
      expect(bubble.x - bubble.r).toBeGreaterThanOrEqual(0)
      expect(bubble.x + bubble.r).toBeLessThanOrEqual(330)
      expect(bubble.y - bubble.r).toBeGreaterThanOrEqual(0)
      expect(bubble.y + bubble.r).toBeLessThanOrEqual(236)
      placed.slice(index + 1).forEach((other) => {
        expect(Math.hypot(bubble.x - other.x, bubble.y - other.y)).toBeGreaterThanOrEqual(
          bubble.r + other.r
        )
      })
    })
  })

  it('makes a bubble smaller when the box has no room for it, instead of leaving it out', () => {
    const placed = packBubbles([180, 180, 180], 200, 200)

    expect(placed).toHaveLength(3)
    expect(Math.min(...placed.map((bubble) => bubble.r))).toBeLessThan(90)
  })
})

describe('bubbleDiameter', () => {
  it('goes from the smallest to the biggest with the count', () => {
    expect(bubbleDiameter(0, 10)).toBe(84)
    expect(bubbleDiameter(10, 10)).toBe(128)
    expect(bubbleDiameter(5, 10)).toBe(106)
  })

  it('is the smallest when nothing was counted', () => {
    expect(bubbleDiameter(0, 0)).toBe(84)
  })
})
