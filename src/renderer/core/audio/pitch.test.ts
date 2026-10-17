import { describe, expect, it } from 'vitest'
import { centsBetween, detectPitch, frequencyOfMidi, nearestNote, type Pitch } from './pitch'
import { addNoise, noise, SAMPLE_RATE, tone } from './syntheticSound'

// One reading of the capture: 2048 samples.
const reading = (signal: Float32Array): Float32Array => signal.subarray(0, 2048)

function pitchOf(signal: Float32Array, sampleRate = SAMPLE_RATE): Pitch {
  const pitch = detectPitch(reading(signal), sampleRate)
  if (!pitch) throw new Error('No pitch was found.')
  return pitch
}

describe('detectPitch', () => {
  it('finds an A at 440 Hz within 10 cents', () => {
    const { frequency } = pitchOf(tone(440, 0.2))

    expect(Math.abs(centsBetween(frequency, 440))).toBeLessThan(10)
  })

  it('is much better than 10 cents on a clean tone', () => {
    expect(Math.abs(centsBetween(pitchOf(tone(440, 0.2)).frequency, 440))).toBeLessThan(2)
  })

  it.each([
    ['E2, the lowest string of a guitar', 82.41],
    ['A2', 110],
    ['D3', 146.83],
    ['G3', 196],
    ['B3', 246.94],
    ['E4, the highest string', 329.63],
    ['A5', 880],
    ['around 1000 Hz', 1000]
  ])('finds %s within 10 cents', (_name, hz) => {
    const { frequency } = pitchOf(tone(hz, 0.2))

    expect(Math.abs(centsBetween(frequency, hz))).toBeLessThan(10)
  })

  it('finds the note of a sound with harmonics, as a string makes', () => {
    const { frequency } = pitchOf(tone(196, 0.2, { harmonics: [1, 0.7, 0.5, 0.3, 0.2] }))

    expect(Math.abs(centsBetween(frequency, 196))).toBeLessThan(10)
  })

  it('still finds the note when the first partial is weak and the others are strong', () => {
    const { frequency } = pitchOf(tone(110, 0.2, { harmonics: [0.3, 1, 0.8, 0.5] }))

    expect(Math.abs(centsBetween(frequency, 110))).toBeLessThan(10)
  })

  it('finds the note with some noise in the room', () => {
    const { frequency } = pitchOf(addNoise(tone(330, 0.2), 0.05))

    expect(Math.abs(centsBetween(frequency, 330))).toBeLessThan(10)
  })

  it('notices a string that is a little flat', () => {
    // A guitar A string tuned 20 cents low.
    const { frequency } = pitchOf(tone(110 * 2 ** (-20 / 1200), 0.2))

    expect(centsBetween(frequency, 110)).toBeCloseTo(-20, -1)
  })

  it('is very sure of a pure tone and less of a dirty one', () => {
    const clear = pitchOf(tone(440, 0.2)).clarity
    const dirty = detectPitch(reading(addNoise(tone(440, 0.2), 0.4)), SAMPLE_RATE)?.clarity ?? 0

    expect(clear).toBeGreaterThan(0.95)
    expect(dirty).toBeLessThan(clear)
  })

  it('finds no pitch in silence or in noise', () => {
    expect(detectPitch(new Float32Array(2048), SAMPLE_RATE)).toBeNull()
    expect(detectPitch(reading(noise(0.2)), SAMPLE_RATE)).toBeNull()
  })

  it('finds no pitch in a sound too quiet to be anything but the room', () => {
    expect(detectPitch(reading(tone(440, 0.2, { amplitude: 0.0005 })), SAMPLE_RATE)).toBeNull()
  })

  it('works at other sample rates', () => {
    const { frequency } = pitchOf(tone(440, 0.2, { sampleRate: 44_100 }), 44_100)

    expect(Math.abs(centsBetween(frequency, 440))).toBeLessThan(10)
  })

  it('does not take a window that is too short for the pitch', () => {
    expect(detectPitch(new Float32Array(100).fill(0.3), SAMPLE_RATE)).toBeNull()
  })
})

describe('centsBetween', () => {
  it('is 1200 for an octave and 100 for a semitone', () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200)
    expect(centsBetween(440 * 2 ** (1 / 12), 440)).toBeCloseTo(100)
  })

  it('is negative below the reference', () => {
    expect(centsBetween(220, 440)).toBeCloseTo(-1200)
  })
})

describe('nearestNote', () => {
  it('names A4 at 440 Hz, in tune', () => {
    expect(nearestNote(440)).toMatchObject({ name: 'A4', midi: 69, cents: 0 })
  })

  it('names the open strings of a guitar', () => {
    expect([82.41, 110, 146.83, 196, 246.94, 329.63].map((hz) => nearestNote(hz).name)).toEqual([
      'E2',
      'A2',
      'D3',
      'G3',
      'B3',
      'E4'
    ])
  })

  it('says how far a pitch is from the note, either way', () => {
    expect(nearestNote(440 * 2 ** (25 / 1200)).cents).toBeCloseTo(25)
    expect(nearestNote(440 * 2 ** (-25 / 1200)).cents).toBeCloseTo(-25)
  })

  it('goes to the next note past the middle of two', () => {
    const note = nearestNote(440 * 2 ** (60 / 1200))

    expect(note.name).toBe('A#4')
    expect(note.cents).toBeCloseTo(-40)
  })

  it('follows another tuning for A4', () => {
    expect(nearestNote(432, 432)).toMatchObject({ name: 'A4', cents: 0 })
  })
})

describe('frequencyOfMidi', () => {
  it('is 440 Hz for A4 and doubles with each octave', () => {
    expect(frequencyOfMidi(69)).toBe(440)
    expect(frequencyOfMidi(81)).toBeCloseTo(880)
  })
})
