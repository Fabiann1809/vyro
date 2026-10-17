// Builds sound out of numbers, to test the audio code without a microphone. Used by the tests only:
// nothing in the app imports this file.

import { levelDb } from './level'

export const SAMPLE_RATE = 48_000

// Repeatable pseudo-random numbers in -1..1, so that a failing run can always be reproduced.
export function seededNoise(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
  }
}

// A note: the given pitch with some of its harmonics, as a string has. `harmonics` are the
// amplitudes of the 1st, 2nd, 3rd... partial.
export function tone(
  frequency: number,
  seconds: number,
  options: {
    amplitude?: number
    harmonics?: readonly number[]
    sampleRate?: number
    phase?: number
  } = {}
): Float32Array {
  const { amplitude = 0.5, harmonics = [1], sampleRate = SAMPLE_RATE, phase = 0 } = options
  const total = harmonics.reduce((sum, value) => sum + Math.abs(value), 0) || 1
  return Float32Array.from({ length: Math.round(seconds * sampleRate) }, (_, index) => {
    const t = index / sampleRate
    return (
      (amplitude / total) *
      harmonics.reduce(
        (sum, weight, partial) =>
          sum + weight * Math.sin(2 * Math.PI * frequency * (partial + 1) * t + phase),
        0
      )
    )
  })
}

export function noise(seconds: number, amplitude = 0.3, seed = 1): Float32Array {
  const next = seededNoise(seed)
  return Float32Array.from({ length: Math.round(seconds * SAMPLE_RATE) }, () => amplitude * next())
}

export function addNoise(signal: Float32Array, amplitude: number, seed = 7): Float32Array {
  const next = seededNoise(seed)
  return signal.map((sample) => sample + amplitude * next())
}

// A click every `60 / bpm` seconds: a short burst of a decaying tone, like a metronome or a pluck.
export function clickTrack(
  bpm: number,
  beats: number,
  options: { firstMs?: number; jitterMs?: number; sampleRate?: number; seed?: number } = {}
): Float32Array {
  const { firstMs = 200, jitterMs = 0, sampleRate = SAMPLE_RATE, seed = 3 } = options
  const beatMs = 60_000 / bpm
  const total = Math.round(((firstMs + beats * beatMs + 300) / 1000) * sampleRate)
  const signal = new Float32Array(total)
  const random = seededNoise(seed)

  for (let beat = 0; beat < beats; beat++) {
    const start = Math.round(((firstMs + beat * beatMs + jitterMs * random()) / 1000) * sampleRate)
    const length = Math.round(0.05 * sampleRate)
    for (let index = 0; index < length && start + index < total; index++) {
      const decay = Math.exp((-6 * index) / length)
      signal[start + index] = 0.8 * decay * Math.sin((2 * Math.PI * 1000 * index) / sampleRate)
    }
  }
  return signal
}

// The loudness over time that the capture would report: one reading every `hopMs`, each over the
// last `windowSamples` samples.
export function levelSeries(
  signal: Float32Array,
  options: { hopMs?: number; windowSamples?: number; sampleRate?: number } = {}
): Array<{ timestampMs: number; levelDb: number }> {
  const { hopMs = 33, windowSamples = 2048, sampleRate = SAMPLE_RATE } = options
  const hop = Math.round((hopMs / 1000) * sampleRate)
  const readings: Array<{ timestampMs: number; levelDb: number }> = []
  for (let end = windowSamples; end <= signal.length; end += hop) {
    readings.push({
      timestampMs: (end / sampleRate) * 1000,
      levelDb: levelDb(signal.subarray(end - windowSamples, end))
    })
  }
  return readings
}

// A plucked string: a note with its partials that dies away, `decaySeconds` being the time it takes
// to fall to a third of its loudness.
export function pluck(
  frequency: number,
  seconds: number,
  options: { amplitude?: number; decaySeconds?: number; harmonics?: readonly number[] } = {}
): Float32Array {
  const { decaySeconds = 1.2, harmonics = [1, 0.5, 0.3] } = options
  const note = tone(frequency, seconds, { amplitude: options.amplitude ?? 0.5, harmonics })
  return note.map((sample, index) => sample * Math.exp(-index / SAMPLE_RATE / decaySeconds))
}

export function silence(seconds: number): Float32Array {
  return new Float32Array(Math.round(seconds * SAMPLE_RATE))
}

// Sounds one after another.
export function sequence(...parts: Float32Array[]): Float32Array {
  const joined = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) {
    joined.set(part, at)
    at += part.length
  }
  return joined
}
