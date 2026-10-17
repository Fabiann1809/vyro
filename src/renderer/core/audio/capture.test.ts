import { describe, expect, it, vi } from 'vitest'
import {
  AudioCapture,
  buildMicrophoneConstraints,
  type AudioContextLike,
  type AudioFeatures,
  type CaptureDeps
} from './capture'

// A microphone that hears a steady sound, and the pieces of Web Audio around it.
function fakeSetup(amplitude = 0.5): {
  deps: CaptureDeps
  track: { stop: ReturnType<typeof vi.fn> }
  context: { close: ReturnType<typeof vi.fn>; destinationUsed: boolean }
  tick: () => void
  stopped: () => boolean
} {
  const track = { stop: vi.fn() }
  const context = { close: vi.fn(() => Promise.resolve()), destinationUsed: false }
  let read: (() => void) | undefined
  let stopped = false

  const analyser = {
    fftSize: 0,
    getFloatTimeDomainData: (array: Float32Array) => array.fill(amplitude)
  }
  const fakeContext = {
    sampleRate: 48_000,
    resume: () => Promise.resolve(),
    close: context.close,
    createAnalyser: () => analyser,
    createMediaStreamSource: () => ({
      connect: (node: unknown) => {
        if (node !== analyser) context.destinationUsed = true
      },
      disconnect: vi.fn()
    }),
    // If anything asked for the speakers, it would show here.
    get destination() {
      context.destinationUsed = true
      return {}
    }
  } as unknown as AudioContextLike

  return {
    deps: {
      getUserMedia: () => Promise.resolve({ getTracks: () => [track] } as unknown as MediaStream),
      createContext: () => fakeContext,
      every: (callback) => {
        read = callback
        return () => {
          stopped = true
        }
      }
    },
    track,
    context,
    tick: () => read?.(),
    stopped: () => stopped
  }
}

describe('AudioCapture', () => {
  it('reports the loudness of what the microphone hears', async () => {
    const { deps, tick } = fakeSetup(1)
    const heard: AudioFeatures[] = []

    await AudioCapture.open((features) => heard.push(features), { deps })
    tick()
    tick()

    expect(heard).toHaveLength(2)
    expect(heard[0]?.levelDb).toBeCloseTo(0)
    expect(heard[0]?.peak).toBe(1)
  })

  it('hands out numbers and nothing else', async () => {
    const { deps, tick } = fakeSetup()
    const heard: unknown[] = []

    await AudioCapture.open((features) => heard.push(features), { deps })
    tick()

    expect(heard).toHaveLength(1)
    for (const features of heard) {
      expect(Object.values(features as object).every((value) => typeof value === 'number')).toBe(
        true
      )
    }
  })

  it('reads every time into the one buffer it has, which the measuring function must not keep', async () => {
    const { deps, tick } = fakeSetup()
    const buffers: Float32Array[] = []

    await AudioCapture.open(() => undefined, {
      deps,
      extract: (samples) => {
        buffers.push(samples)
        return { levelDb: 0, peak: 0 }
      }
    })
    tick()
    tick()
    tick()

    expect(buffers).toHaveLength(3)
    expect(new Set(buffers).size).toBe(1)
  })

  it('gives the sample rate to the measuring function, for the features that need it', async () => {
    const { deps, tick } = fakeSetup()
    const rates: number[] = []

    await AudioCapture.open(() => undefined, {
      deps,
      extract: (_samples, rate) => {
        rates.push(rate)
        return { levelDb: 0, peak: 0 }
      }
    })
    tick()

    expect(rates).toEqual([48_000])
  })

  it('is only connected to the analyser: nothing is played, so nothing can feed back', async () => {
    const { deps, context } = fakeSetup()

    await AudioCapture.open(() => undefined, { deps })

    expect(context.destinationUsed).toBe(false)
  })

  it('lets go of the microphone and stops reading when it is closed', async () => {
    const { deps, track, context, stopped } = fakeSetup()
    const capture = await AudioCapture.open(() => undefined, { deps })

    capture.close()

    expect(track.stop).toHaveBeenCalled()
    expect(context.close).toHaveBeenCalled()
    expect(stopped()).toBe(true)
  })

  it('does not keep the microphone if it cannot start', async () => {
    const { deps, track } = fakeSetup()
    const broken: CaptureDeps = {
      ...deps,
      createContext: () =>
        ({
          sampleRate: 48_000,
          resume: () => Promise.reject(new Error('no')),
          close: () => Promise.resolve(),
          createAnalyser: () => ({}),
          createMediaStreamSource: () => ({})
        }) as unknown as AudioContextLike
    }

    await expect(AudioCapture.open(() => undefined, { deps: broken })).rejects.toThrow()

    expect(track.stop).toHaveBeenCalled()
  })

  it('shows nothing inside: no stream, no buffer, only the way to close it', async () => {
    const { deps } = fakeSetup()
    const capture = await AudioCapture.open(() => undefined, { deps })

    expect(Object.getOwnPropertyNames(capture)).toEqual([])
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(capture)).sort()).toEqual([
      'close',
      'constructor'
    ])
  })
})

describe('buildMicrophoneConstraints', () => {
  it('asks for raw sound, without the filters of a call, and for no video', () => {
    expect(buildMicrophoneConstraints()).toEqual({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false
    })
  })

  it('asks for the input that was chosen', () => {
    expect(buildMicrophoneConstraints('mic-2')).toMatchObject({
      audio: { deviceId: { exact: 'mic-2' } }
    })
  })
})
