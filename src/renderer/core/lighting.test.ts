import { describe, expect, it } from 'vitest'
import { meanLuminance } from './lighting'

describe('meanLuminance', () => {
  it('is 0 for black and 255 for white pixels', () => {
    expect(meanLuminance([0, 0, 0, 255, 0, 0, 0, 255])).toBe(0)
    expect(meanLuminance([255, 255, 255, 255])).toBeCloseTo(255)
  })

  it('averages the pixels and weights green more than blue', () => {
    expect(meanLuminance([255, 255, 255, 255, 0, 0, 0, 255])).toBeCloseTo(127.5)
    expect(meanLuminance([0, 255, 0, 255])).toBeGreaterThan(meanLuminance([0, 0, 255, 255]))
  })

  it('is 0 when there are no pixels', () => {
    expect(meanLuminance([])).toBe(0)
  })
})
