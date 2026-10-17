import { describe, expect, it } from 'vitest'
import { FrameBudget } from './frameBudget'

describe('FrameBudget', () => {
  it('runs while there is time', () => {
    const budget = new FrameBudget(33)
    budget.record(8)

    expect(budget.shouldRun(15)).toBe(true)
  })

  it('skips when the body took most of the frame, but not for long', () => {
    const budget = new FrameBudget(33, 2)
    budget.record(20)

    expect([budget.shouldRun(25), budget.shouldRun(25), budget.shouldRun(25)]).toEqual([
      false,
      false,
      true
    ])
    // After running, it may skip again.
    expect(budget.shouldRun(25)).toBe(false)
  })

  it('learns how long hands take, favouring the latest frames', () => {
    const budget = new FrameBudget(33, 100)
    budget.record(5)
    for (let index = 0; index < 20; index++) budget.record(30)

    expect(budget.shouldRun(10)).toBe(false)
  })

  it('always runs the first time, when it has no idea of the cost yet', () => {
    expect(new FrameBudget(33).shouldRun(32)).toBe(true)
  })
})
