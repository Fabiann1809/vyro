// Pitch of a sound, by the YIN method (de Cheveigné and Kawahara, 2002): it looks for the delay at
// which the sound best repeats itself, which is its period. It is steadier than counting zero
// crossings and does not mistake a harmonic for the note, as a peak in the spectrum may.

export interface Pitch {
  // Hertz.
  frequency: number
  // How periodic the sound is, 0..1. A pure tone is near 1; noise is low.
  clarity: number
}

export const MIN_PITCH_HZ = 60
export const MAX_PITCH_HZ = 1200

// A dip in the difference function counts as a period only if it goes below this.
const THRESHOLD = 0.15
// Below this loudness there is nothing to tell the pitch of (it would be the noise of the room).
const MIN_RMS = 0.002

// The difference function normalised by its running mean: 1 for noise, near 0 at the period.
function normalisedDifference(samples: Float32Array, maxLag: number): Float32Array {
  const window = samples.length - maxLag
  const difference = new Float32Array(maxLag)
  for (let lag = 1; lag < maxLag; lag++) {
    let sum = 0
    for (let index = 0; index < window; index++) {
      const delta = (samples[index] ?? 0) - (samples[index + lag] ?? 0)
      sum += delta * delta
    }
    difference[lag] = sum
  }

  const normalised = new Float32Array(maxLag)
  normalised[0] = 1
  let running = 0
  for (let lag = 1; lag < maxLag; lag++) {
    running += difference[lag] ?? 0
    normalised[lag] = running === 0 ? 1 : ((difference[lag] ?? 0) * lag) / running
  }
  return normalised
}

// The lowest delay under the threshold, going down to the bottom of its dip.
function firstPeriod(normalised: Float32Array, minLag: number): number | null {
  for (let lag = Math.max(2, minLag); lag < normalised.length - 1; lag++) {
    if ((normalised[lag] ?? 1) < THRESHOLD) {
      let bottom = lag
      while (
        bottom + 1 < normalised.length - 1 &&
        (normalised[bottom + 1] ?? 1) < (normalised[bottom] ?? 1)
      ) {
        bottom++
      }
      return bottom
    }
  }
  return null
}

// The delay between the samples, refined with the parabola through the three samples around it.
function refine(normalised: Float32Array, lag: number): number {
  const before = normalised[lag - 1] ?? 0
  const at = normalised[lag] ?? 0
  const after = normalised[lag + 1] ?? 0
  const denominator = before - 2 * at + after
  return denominator === 0 ? lag : lag + (before - after) / (2 * denominator)
}

// The pitch of the sound, or null when it has none: silence, noise, or several notes at once.
export function detectPitch(samples: Float32Array, sampleRate: number): Pitch | null {
  let energy = 0
  for (const sample of samples) energy += sample * sample
  if (samples.length === 0 || Math.sqrt(energy / samples.length) < MIN_RMS) return null

  const minLag = Math.floor(sampleRate / MAX_PITCH_HZ)
  // The window must hold two periods of the lowest pitch to be asked about.
  const maxLag = Math.min(Math.ceil(sampleRate / MIN_PITCH_HZ), Math.floor(samples.length / 2))
  if (maxLag <= minLag + 2) return null

  const normalised = normalisedDifference(samples, maxLag)
  const lag = firstPeriod(normalised, minLag)
  if (lag === null) return null

  const period = refine(normalised, lag)
  return {
    frequency: sampleRate / period,
    clarity: Math.min(1, Math.max(0, 1 - (normalised[lag] ?? 1)))
  }
}

// How far one pitch is from another, in cents (a hundredth of a semitone); positive when it is higher.
export const centsBetween = (frequency: number, reference: number): number =>
  1200 * Math.log2(frequency / reference)

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export const A4_HZ = 440

export interface Note {
  // For example "A4".
  name: string
  // MIDI number: 69 is A4.
  midi: number
  frequency: number
  // How far the sound is from the note, in cents, -50..50.
  cents: number
}

export const frequencyOfMidi = (midi: number, a4 = A4_HZ): number => a4 * 2 ** ((midi - 69) / 12)

// The note nearest to a pitch, and how out of tune the pitch is from it.
export function nearestNote(frequency: number, a4 = A4_HZ): Note {
  const midi = Math.round(69 + 12 * Math.log2(frequency / a4))
  const reference = frequencyOfMidi(midi, a4)
  const name = NOTE_NAMES[((midi % 12) + 12) % 12] ?? 'A'
  return {
    name: `${name}${Math.floor(midi / 12) - 1}`,
    midi,
    frequency: reference,
    cents: centsBetween(frequency, reference)
  }
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

// "A4" is 69, "C#3" is 49, "Bb2" is 46. Null for a text that is not a note.
export function noteToMidi(name: string): number | null {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name)
  if (!match) return null
  const [, letter = '', accidental = '', octave = ''] = match
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
  return (Number(octave) + 1) * 12 + (SEMITONES[letter] ?? 0) + shift
}
