import { describe, expect, it } from 'vitest'
import { beatOffset, beatStatus } from './beat'

describe('beatStatus', () => {
  it.each([
    [null, 'silent'],
    [60, 'slow'],
    [71, 'slow'],
    [72, 'steady'],
    [80, 'steady'],
    [88, 'steady'],
    [89, 'fast'],
    [120, 'fast']
  ] as const)('reads %s beats per minute against 80 as %s', (bpm, status) => {
    expect(beatStatus(bpm, 80)).toBe(status)
  })
})

describe('beatOffset', () => {
  it('is zero on the pace asked for, and signed around it', () => {
    expect(beatOffset(80, 80)).toBe(0)
    expect(beatOffset(88, 80)).toBeCloseTo(0.1)
    expect(beatOffset(72, 80)).toBeCloseTo(-0.1)
  })

  it('stays inside the scale of the needle', () => {
    expect(beatOffset(400, 80)).toBe(0.5)
    expect(beatOffset(10, 80)).toBe(-0.5)
  })
})
