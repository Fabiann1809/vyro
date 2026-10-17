import { describe, expect, it } from 'vitest'
import { CalibrationFlow } from '../calibrationFlow'
import { AudioFraming, type AudioFramingReport } from './audioFraming'

const STEP_MS = 33

// Feeds the same reading for a while, as many as fit in `ms`; returns the last report.
function hear(
  framing: AudioFraming,
  from: number,
  ms: number,
  levelDb: number,
  peak = 0.1
): { report: AudioFramingReport; now: number } {
  let report: AudioFramingReport = framing.waiting()
  let now = from
  for (; now < from + ms; now += STEP_MS) report = framing.update(now, levelDb, peak)
  return { report, now }
}

describe('AudioFraming', () => {
  it('waits for the microphone before it hears anything', () => {
    expect(new AudioFraming().waiting()).toEqual({
      noise: 'pending',
      sound: 'pending',
      instruction: 'waitForMicrophone'
    })
  })

  it('first listens to the room', () => {
    const framing = new AudioFraming()

    expect(hear(framing, 0, 600, -60).report).toEqual({
      noise: 'pending',
      sound: 'pending',
      instruction: 'measuringRoom'
    })
  })

  it('accepts a quiet room and then asks for a sound', () => {
    const framing = new AudioFraming()

    const { report } = hear(framing, 0, 2000, -60)

    expect(report).toMatchObject({ noise: 'ok', instruction: 'makeSound' })
  })

  it('does not let start in a room that is too noisy', () => {
    const framing = new AudioFraming()

    const { report, now } = hear(framing, 0, 2000, -30)

    expect(report).toEqual({ noise: 'fix', sound: 'pending', instruction: 'quietRoom' })
    // Even a good sound does not get past a noisy room.
    expect(hear(framing, now, 3000, -10).report.instruction).toBe('quietRoom')
  })

  it('listens to the room again, in case the noise passed', () => {
    const framing = new AudioFraming()
    const noisy = hear(framing, 0, 2000, -30)

    const quiet = hear(framing, noisy.now, 2000, -60)

    expect(quiet.report).toMatchObject({ noise: 'ok' })
  })

  it('is satisfied by a sound that stands out from the room', () => {
    const framing = new AudioFraming()
    const room = hear(framing, 0, 2000, -60)

    const { report } = hear(framing, room.now, 200, -20)

    expect(report).toEqual({ noise: 'ok', sound: 'ok', instruction: null })
  })

  it('keeps being satisfied after the note dies away', () => {
    const framing = new AudioFraming()
    const room = hear(framing, 0, 2000, -60)
    const played = hear(framing, room.now, 200, -20)

    expect(hear(framing, played.now, 2000, -60).report.instruction).toBeNull()
  })

  it('asks to make a sound when nothing is heard at all', () => {
    const framing = new AudioFraming()
    const room = hear(framing, 0, 2000, -70)

    expect(hear(framing, room.now, 2000, -70).report).toEqual({
      noise: 'ok',
      sound: 'pending',
      instruction: 'makeSound'
    })
  })

  it('asks for a bit more when the sound is there but weak', () => {
    const framing = new AudioFraming()
    const room = hear(framing, 0, 2000, -70)

    expect(hear(framing, room.now, 500, -48).report).toEqual({
      noise: 'ok',
      sound: 'fix',
      instruction: 'louder'
    })
  })

  it('asks for more when it does not rise enough above a room that is not so quiet', () => {
    const framing = new AudioFraming()
    const room = hear(framing, 0, 2000, -50)

    expect(hear(framing, room.now, 500, -42).report.instruction).toBe('louder')
  })

  it('says so when the sound is cut off, and does not accept it', () => {
    const framing = new AudioFraming()
    const room = hear(framing, 0, 2000, -60)

    const { report } = hear(framing, room.now, 300, -2, 1)

    expect(report).toEqual({ noise: 'ok', sound: 'fix', instruction: 'tooLoud' })
  })

  it('accepts a good sound after a cut off one', () => {
    const framing = new AudioFraming()
    const room = hear(framing, 0, 2000, -60)
    const loud = hear(framing, room.now, 300, -2, 1)

    expect(hear(framing, loud.now, 300, -20).report.instruction).toBeNull()
  })

  it('starts over when reset', () => {
    const framing = new AudioFraming()
    hear(framing, 0, 3000, -60)

    framing.reset()

    expect(framing.update(0, -60, 0.1).instruction).toBe('measuringRoom')
  })
})

describe('starting a skill that listens', () => {
  function startsAfter(levels: Array<[ms: number, levelDb: number]>): boolean {
    const framing = new AudioFraming()
    const flow = new CalibrationFlow()
    let now = 0
    for (const [ms, levelDb] of levels) {
      const end = now + ms
      for (; now < end; now += STEP_MS) {
        const report = framing.update(now, levelDb, 0.1)
        if (flow.update(report.instruction === null, now).phase === 'countdown') return true
      }
    }
    return false
  }

  it('does not start in a noisy room, however long it waits', () => {
    expect(startsAfter([[10_000, -30]])).toBe(false)
  })

  it('does not start in silence, however long it waits', () => {
    expect(startsAfter([[10_000, -75]])).toBe(false)
  })

  it('starts the countdown once the room is quiet and a sound has been heard', () => {
    expect(
      startsAfter([
        [2000, -60],
        [300, -20],
        [2000, -60]
      ])
    ).toBe(true)
  })
})
