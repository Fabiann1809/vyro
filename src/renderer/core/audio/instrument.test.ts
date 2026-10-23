import { describe, expect, it } from 'vitest'
import windows from './instrumentWindows.fixture.json'
import {
  InstrumentTracker,
  scoreInstruments,
  type HeardClass,
  type InstrumentReading
} from './instrument'

const heard = (name: string, score: number): HeardClass[] => [{ name, score }]

// Feeds a list of windows, one every half second, and returns the last reading.
function listen(
  tracker: InstrumentTracker,
  list: readonly (readonly HeardClass[])[],
  from = 0
): InstrumentReading {
  let reading = tracker.update(from, [])
  list.forEach((classes, index) => {
    reading = tracker.update(from + (index + 1) * 500, classes)
  })
  return reading
}

describe('scoreInstruments', () => {
  it('gives each instrument the score of its likeliest class', () => {
    const scores = scoreInstruments([
      { name: 'Guitar', score: 0.2 },
      { name: 'Acoustic guitar', score: 0.7 },
      { name: 'Flute', score: 0.1 }
    ])

    expect(scores.guitar).toBe(0.7)
    expect(scores.flute).toBe(0.1)
    expect(scores.piano).toBe(0)
  })

  it('ignores classes that are not an instrument of the list', () => {
    const scores = scoreInstruments([
      { name: 'Silence', score: 0.9 },
      { name: 'Music', score: 0.9 }
    ])

    expect(Object.values(scores).every((score) => score === 0)).toBe(true)
  })
})

describe('InstrumentTracker', () => {
  it('hears the instrument that keeps sounding', () => {
    const reading = listen(new InstrumentTracker(), Array(6).fill(heard('Flute', 0.85)))

    expect(reading.heard).toBe('flute')
    expect(reading.scores.flute).toBeGreaterThan(0.6)
  })

  it('does not jump to an instrument on a single window', () => {
    const tracker = new InstrumentTracker()
    listen(tracker, Array(4).fill([]))

    expect(tracker.update(2500, heard('Piano', 0.9)).heard).toBeNull()
  })

  it('hears none in silence and in noise', () => {
    for (const clip of ['silence', 'noise'] as const) {
      const reading = listen(new InstrumentTracker(), windows[clip])
      expect(reading.heard, clip).toBeNull()
    }
  })

  it('hears none in the synthetic tones, which are not instruments for the model', () => {
    // Real answers of the model (tools/instrument-classifier). They show that these stand-ins do not
    // prove recognition of a real instrument, only that nothing is made up for them.
    for (const clip of ['flute', 'guitar', 'piano', 'voice'] as const) {
      expect(listen(new InstrumentTracker(), windows[clip]).heard, clip).toBeNull()
    }
  })

  it('keeps an instrument through a short dip, without flickering', () => {
    const tracker = new InstrumentTracker()
    listen(tracker, Array(6).fill(heard('Guitar', 0.8)))

    expect(tracker.update(4000, heard('Guitar', 0.2)).heard).toBe('guitar')
  })

  it('lets go of the instrument when the sound stops', () => {
    const tracker = new InstrumentTracker()
    listen(tracker, Array(6).fill(heard('Guitar', 0.8)))
    const reading = listen(tracker, Array(10).fill(heard('Silence', 0.9)), 4000)

    expect(reading.heard).toBeNull()
  })

  it('moves to another instrument that sounds louder', () => {
    const tracker = new InstrumentTracker()
    listen(tracker, Array(6).fill(heard('Piano', 0.8)))
    const reading = listen(tracker, Array(8).fill(heard('Flute', 0.9)), 4000)

    expect(reading.heard).toBe('flute')
  })
})
