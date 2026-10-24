import { describe, expect, it } from 'vitest'
import { HoldClock } from './holdClock'

describe('HoldClock', () => {
  it('counts from the moment the position is taken', () => {
    const clock = new HoldClock()

    expect(clock.update('posed', 'posed', 1000)).toBe(0)
    expect(clock.update('posed', 'posed', 4500)).toBe(3500)
  })

  it('is null while out of position', () => {
    const clock = new HoldClock()

    expect(clock.update('away', 'posed', 1000)).toBeNull()
    expect(clock.update(null, 'posed', 2000)).toBeNull()
  })

  it('starts again after a break', () => {
    const clock = new HoldClock()
    clock.update('posed', 'posed', 0)
    clock.update('away', 'posed', 3000)

    expect(clock.update('posed', 'posed', 5000)).toBe(0)
  })
})
