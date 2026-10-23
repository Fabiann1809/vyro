import { describe, expect, it, vi } from 'vitest'
import { InstrumentListener } from './instrumentListener'
import { WINDOW_SECONDS } from './soundWindow'

const RATE = 1000
const CHUNK = new Float32Array(Math.ceil(WINDOW_SECONDS * RATE))

describe('InstrumentListener', () => {
  it('says nothing until it has heard a whole window', () => {
    const classify = vi.fn(() => [{ name: 'Flute', score: 0.9 }])
    const listener = new InstrumentListener(classify)

    expect(listener.push(new Float32Array(100), RATE, 0)).toBeNull()
    expect(classify).not.toHaveBeenCalled()
  })

  it('hears the instrument that the model recognises', () => {
    const listener = new InstrumentListener(() => [{ name: 'Flute', score: 0.9 }])
    let reading = listener.push(CHUNK, RATE, 0)
    for (let ms = 500; ms <= 3000; ms += 500) reading = listener.push(CHUNK, RATE, ms)

    expect(reading?.heard).toBe('flute')
  })

  it('does not ask the model at every reading', () => {
    const classify = vi.fn(() => [])
    const listener = new InstrumentListener(classify)
    for (let ms = 0; ms < 1000; ms += 33) listener.push(CHUNK, RATE, ms)

    expect(classify.mock.calls.length).toBeLessThanOrEqual(2)
  })

  it('gives the model the sound and its sample rate', () => {
    const classify = vi.fn(() => [])
    new InstrumentListener(classify).push(CHUNK, RATE, 0)

    expect(classify).toHaveBeenCalledWith(expect.any(Float32Array), RATE)
  })
})
