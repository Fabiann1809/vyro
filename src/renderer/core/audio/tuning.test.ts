import { describe, expect, it } from 'vitest'
import { InTuneHold, nextUntuned, tuningStatus } from './tuning'

describe('tuningStatus', () => {
  it.each([
    [null, 'silent'],
    [-30, 'flat'],
    [-5, 'inTune'],
    [0, 'inTune'],
    [5, 'inTune'],
    [6, 'sharp'],
    [149, 'sharp'],
    [-200, 'otherString'],
    [400, 'otherString']
  ] as const)('reads %s cents as %s', (cents, status) => {
    expect(tuningStatus(cents)).toBe(status)
  })
})

describe('InTuneHold', () => {
  it('is reached after staying in tune for the whole time, once', () => {
    const hold = new InTuneHold(1000)

    expect(hold.update(0, 2)).toBe(false)
    expect(hold.update(999, -1)).toBe(false)
    expect(hold.update(1000, 0)).toBe(true)
    expect(hold.update(1500, 0)).toBe(false)
  })

  it('does not count a pitch that only crosses the note', () => {
    const hold = new InTuneHold(1000)
    hold.update(0, 2)
    hold.update(600, 30)

    expect(hold.update(1200, 1)).toBe(false)
    expect(hold.update(2100, 1)).toBe(false)
    expect(hold.update(2200, 1)).toBe(true)
  })

  it('starts again when the sound stops for a while', () => {
    const hold = new InTuneHold(1000)
    hold.update(0, 0)
    hold.update(500, null)
    hold.update(900, null)

    expect(hold.update(1000, 0)).toBe(false)
    expect(hold.update(2000, 0)).toBe(true)
  })

  it('forgives a moment with no clear note while the string rings', () => {
    const hold = new InTuneHold(1000)
    hold.update(0, 0)
    hold.update(500, 0)
    hold.update(600, null)

    expect(hold.update(1000, 0)).toBe(true)
  })

  it('can be reached again after reset, for the next string', () => {
    const hold = new InTuneHold(1000)
    hold.update(0, 0)
    hold.update(1000, 0)
    hold.reset()

    expect(hold.update(1100, 0)).toBe(false)
    expect(hold.update(2100, 0)).toBe(true)
  })

  it('tells how much of the time has gone by', () => {
    const hold = new InTuneHold(1000)

    expect(hold.progress(0)).toBe(0)
    hold.update(0, 0)
    expect(hold.progress(250)).toBe(0.25)
    expect(hold.progress(5000)).toBe(1)
  })
})

describe('nextUntuned', () => {
  it('goes to the next string that is not tuned yet', () => {
    expect(nextUntuned(0, new Set([0]), 6)).toBe(1)
    expect(nextUntuned(1, new Set([1, 2]), 6)).toBe(3)
  })

  it('goes round to the start', () => {
    expect(nextUntuned(5, new Set([5, 0]), 6)).toBe(1)
  })

  it('is null when every string is tuned', () => {
    expect(nextUntuned(2, new Set([0, 1, 2]), 3)).toBeNull()
  })
})
