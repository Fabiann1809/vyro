import { describe, expect, it } from 'vitest'
import { DwellTracker, type DwellTarget } from './dwell'

const targets: DwellTarget[] = [
  { id: 'pause', rect: { x0: 0, y0: 0, x1: 0.25, y1: 1 }, holdMs: 1000 },
  { id: 'finish', rect: { x0: 0.75, y0: 0, x1: 1, y1: 1 }, holdMs: 2000 }
]

const left = { x: 0.1, y: 0.5 }
const right = { x: 0.9, y: 0.5 }
const middle = { x: 0.5, y: 0.5 }

describe('DwellTracker', () => {
  it('fills as the pointer stays on a button, and presses it when it is full', () => {
    const tracker = new DwellTracker(targets)

    expect(tracker.update(left, 0).progress['pause']).toBe(0)
    expect(tracker.update(left, 500).progress['pause']).toBeCloseTo(0.5)
    expect(tracker.update(left, 999).fired).toBeNull()
    expect(tracker.update(left, 1000).fired).toBe('pause')
  })

  it('asks for a longer hold on the button that matters more', () => {
    const tracker = new DwellTracker(targets)

    tracker.update(right, 0)

    expect(tracker.update(right, 1000).fired).toBeNull()
    expect(tracker.update(right, 1000).progress['finish']).toBeCloseTo(0.5)
    expect(tracker.update(right, 2000).fired).toBe('finish')
  })

  it('starts again when the pointer leaves for longer than the grace time', () => {
    const tracker = new DwellTracker(targets, { graceMs: 300 })

    tracker.update(left, 0)
    tracker.update(left, 600)
    tracker.update(middle, 700)
    expect(tracker.update(middle, 850).progress['pause']).toBeGreaterThan(0)
    tracker.update(middle, 950)
    expect(tracker.update(middle, 1001).progress['pause']).toBe(0)

    tracker.update(left, 1100)
    expect(tracker.update(left, 1600).progress['pause']).toBeCloseTo(0.5)
  })

  it('forgives a short loss of the pointer', () => {
    const tracker = new DwellTracker(targets, { graceMs: 300 })

    tracker.update(left, 0)
    tracker.update(null, 250)
    tracker.update(left, 300)

    // The 250 ms of the loss do not count, but the hold goes on where it was.
    expect(tracker.update(left, 1000).fired).toBeNull()
    expect(tracker.update(left, 1250).fired).toBe('pause')
  })

  it('never presses a button from outside it, however long the grace time', () => {
    const tracker = new DwellTracker(targets, { graceMs: 5000 })

    tracker.update(left, 0)
    tracker.update(left, 900)

    for (let time = 1000; time <= 4000; time += 100) {
      expect(tracker.update(null, time).fired).toBeNull()
    }
  })

  it('does not carry the time from one button to the other', () => {
    const tracker = new DwellTracker([
      { id: 'a', rect: { x0: 0, y0: 0, x1: 0.5, y1: 1 }, holdMs: 1000 },
      { id: 'b', rect: { x0: 0.5, y0: 0, x1: 1, y1: 1 }, holdMs: 1000 }
    ])

    tracker.update({ x: 0.2, y: 0.5 }, 0)
    tracker.update({ x: 0.2, y: 0.5 }, 900)

    expect(tracker.update({ x: 0.8, y: 0.5 }, 950).progress['b']).toBe(0)
  })

  it('presses once per gesture: nothing happens during the cooldown', () => {
    const tracker = new DwellTracker(targets, { cooldownMs: 2000 })
    tracker.update(left, 0)
    expect(tracker.update(left, 1000).fired).toBe('pause')

    expect(tracker.update(left, 1500)).toEqual({ progress: { pause: 0, finish: 0 }, fired: null })
    expect(tracker.update(left, 2900).fired).toBeNull()

    // After it, the same button can be pressed again, from zero.
    tracker.update(left, 3100)
    expect(tracker.update(left, 4100).fired).toBe('pause')
  })

  it('does nothing without a pointer', () => {
    const tracker = new DwellTracker(targets)

    expect(tracker.update(null, 0)).toEqual({ progress: { pause: 0, finish: 0 }, fired: null })
    expect(tracker.update(null, 5000).fired).toBeNull()
  })
})
