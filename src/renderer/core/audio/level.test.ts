import { describe, expect, it } from 'vitest'
import { levelDb, meterFraction, peakLevel, SILENCE_DB } from './level'

const sine = (amplitude: number, length = 1024): Float32Array =>
  Float32Array.from({ length }, (_, index) => amplitude * Math.sin((2 * Math.PI * index) / 64))

describe('levelDb', () => {
  it('is silence for no sound', () => {
    expect(levelDb(new Float32Array(512))).toBe(SILENCE_DB)
    expect(levelDb(new Float32Array(0))).toBe(SILENCE_DB)
  })

  it('is 0 dB for a constant at full scale', () => {
    expect(levelDb(new Float32Array(512).fill(1))).toBeCloseTo(0)
  })

  it('is 3 dB below full scale for a sine wave at full scale (its RMS is 0.707)', () => {
    expect(levelDb(sine(1))).toBeCloseTo(-3.01, 1)
  })

  it('goes down 6 dB every time the sound is halved', () => {
    expect(levelDb(sine(0.5)) - levelDb(sine(1))).toBeCloseTo(-6.02, 1)
  })

  it('does not go below the floor for a sound that is nearly nothing', () => {
    expect(levelDb(new Float32Array(512).fill(1e-9))).toBe(SILENCE_DB)
  })
})

describe('peakLevel', () => {
  it('is the largest sample, whatever its sign', () => {
    expect(peakLevel(Float32Array.from([0.1, -0.7, 0.3]))).toBeCloseTo(0.7)
    expect(peakLevel(new Float32Array(4))).toBe(0)
  })
})

describe('meterFraction', () => {
  it('is empty at the floor and full at 0 dB', () => {
    expect(meterFraction(-60)).toBe(0)
    expect(meterFraction(0)).toBe(1)
    expect(meterFraction(-30)).toBeCloseTo(0.5)
  })

  it('stays between empty and full', () => {
    expect(meterFraction(-100)).toBe(0)
    expect(meterFraction(10)).toBe(1)
  })
})
