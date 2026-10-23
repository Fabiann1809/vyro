import { describe, expect, it } from 'vitest'
import { SoundWindow, WINDOW_SECONDS } from './soundWindow'

const RATE = 1000
const SIZE = Math.ceil(WINDOW_SECONDS * RATE)

describe('SoundWindow', () => {
  it('is not ready until a whole window has been heard', () => {
    const window = new SoundWindow()
    window.push(new Float32Array(SIZE - 1), RATE)

    expect(window.latest()).toBeNull()
    window.push(new Float32Array(1), RATE)
    expect(window.latest()).toHaveLength(SIZE)
  })

  it('keeps the latest sound, oldest first', () => {
    const window = new SoundWindow()
    window.push(new Float32Array(SIZE).fill(1), RATE)
    window.push(new Float32Array(10).fill(2), RATE)
    const latest = window.latest()

    expect(latest?.[SIZE - 11]).toBe(1)
    expect(latest?.[SIZE - 10]).toBe(2)
    expect(latest?.[SIZE - 1]).toBe(2)
  })

  it('keeps only the end of a reading longer than the window', () => {
    const window = new SoundWindow()
    const long = Float32Array.from({ length: SIZE * 2 }, (_, index) => index)
    window.push(long, RATE)

    expect(window.latest()?.[0]).toBe(SIZE)
  })

  it('starts over when the sample rate changes', () => {
    const window = new SoundWindow()
    window.push(new Float32Array(SIZE), RATE)
    window.push(new Float32Array(10), 2000)

    expect(window.latest()).toBeNull()
  })

  it('hands out a copy that later sound does not change', () => {
    const window = new SoundWindow()
    window.push(new Float32Array(SIZE).fill(1), RATE)
    const first = window.latest()
    window.push(new Float32Array(SIZE).fill(2), RATE)

    expect(first?.[0]).toBe(1)
  })
})
