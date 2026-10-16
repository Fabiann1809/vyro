import { describe, expect, it } from 'vitest'
import { CalibrationFlow } from './calibrationFlow'

describe('CalibrationFlow', () => {
  it('keeps checking while the framing is wrong', () => {
    const flow = new CalibrationFlow()

    expect(flow.update(false, 0)).toEqual({ phase: 'checking' })
    expect(flow.update(false, 5000)).toEqual({ phase: 'checking' })
  })

  it('waits for the framing to hold before it starts counting', () => {
    const flow = new CalibrationFlow()

    expect(flow.update(true, 0)).toEqual({ phase: 'checking' })
    expect(flow.update(true, 700)).toEqual({ phase: 'checking' })
    expect(flow.update(true, 800)).toEqual({ phase: 'countdown', remaining: 3 })
  })

  it('counts 3, 2, 1 and then is done', () => {
    const flow = new CalibrationFlow()
    flow.update(true, 0)
    flow.update(true, 800)

    expect(flow.update(true, 1700)).toEqual({ phase: 'countdown', remaining: 3 })
    expect(flow.update(true, 1900)).toEqual({ phase: 'countdown', remaining: 2 })
    expect(flow.update(true, 2900)).toEqual({ phase: 'countdown', remaining: 1 })
    expect(flow.update(true, 3800)).toEqual({ phase: 'done' })
  })

  it('stays done once it is done', () => {
    const flow = new CalibrationFlow()
    flow.update(true, 0)
    flow.update(true, 800)
    flow.update(true, 3800)

    expect(flow.update(false, 9000)).toEqual({ phase: 'done' })
  })

  it('survives a short slip during the countdown', () => {
    const flow = new CalibrationFlow()
    flow.update(true, 0)
    flow.update(true, 800)

    expect(flow.update(false, 1100)).toEqual({ phase: 'countdown', remaining: 3 })
    expect(flow.update(true, 1300)).toEqual({ phase: 'countdown', remaining: 3 })
    expect(flow.update(true, 1900)).toEqual({ phase: 'countdown', remaining: 2 })
  })

  it('cancels the countdown when the person stays out of place', () => {
    const flow = new CalibrationFlow()
    flow.update(true, 0)
    flow.update(true, 800)
    flow.update(true, 1000)

    expect(flow.update(false, 1100)).toMatchObject({ phase: 'countdown' })
    expect(flow.update(false, 1600)).toEqual({ phase: 'checking' })
  })

  it('has to hold the framing again after a cancelled countdown', () => {
    const flow = new CalibrationFlow()
    flow.update(true, 0)
    flow.update(true, 800)
    flow.update(false, 1000)
    flow.update(false, 2000)

    expect(flow.update(true, 2100)).toEqual({ phase: 'checking' })
    expect(flow.update(true, 2900)).toEqual({ phase: 'countdown', remaining: 3 })
  })

  it('can start over', () => {
    const flow = new CalibrationFlow()
    flow.update(true, 0)
    flow.update(true, 800)
    flow.update(true, 3800)
    flow.reset()

    expect(flow.update(false, 4000)).toEqual({ phase: 'checking' })
  })
})
