import { describe, expect, it, vi } from 'vitest'
import type { AudioContextLike, CaptureDeps } from '@renderer/core/audio/capture'
import { listenToMicrophone } from './microphone'

function setup(access: 'granted' | 'denied' | 'unknown' = 'unknown'): {
  api: Parameters<typeof listenToMicrophone>[0]
  calls: string[]
  deps: CaptureDeps
} {
  const calls: string[] = []
  const api = {
    microphone: {
      setOpen: vi.fn((open: boolean) => {
        calls.push(`setOpen:${open}`)
        return Promise.resolve()
      }),
      requestAccess: vi.fn(() => {
        calls.push('requestAccess')
        return Promise.resolve(access)
      })
    }
  }
  const analyser = { fftSize: 0, getFloatTimeDomainData: () => undefined }
  const deps: CaptureDeps = {
    getUserMedia: () => {
      calls.push('getUserMedia')
      return Promise.resolve({ getTracks: () => [] } as unknown as MediaStream)
    },
    createContext: () =>
      ({
        sampleRate: 48_000,
        resume: () => Promise.resolve(),
        close: () => Promise.resolve(),
        createAnalyser: () => analyser,
        createMediaStreamSource: () => ({ connect: () => undefined })
      }) as unknown as AudioContextLike,
    every: () => () => undefined
  }
  return { api, calls, deps }
}

describe('listenToMicrophone', () => {
  it('tells the main process before it asks for the microphone, and again when it stops', async () => {
    const { api, calls, deps } = setup()

    const listening = await listenToMicrophone(api, () => undefined, { deps })
    listening.close()

    expect(calls).toEqual(['setOpen:true', 'requestAccess', 'getUserMedia', 'setOpen:false'])
  })

  it('does not open the microphone when the system denied it, and closes the gate again', async () => {
    const { api, calls, deps } = setup('denied')

    await expect(listenToMicrophone(api, () => undefined, { deps })).rejects.toMatchObject({
      name: 'NotAllowedError'
    })

    expect(calls).toEqual(['setOpen:true', 'requestAccess', 'setOpen:false'])
  })

  it('closes the gate again when the microphone cannot be opened', async () => {
    const { api, calls, deps } = setup()
    const failing = { ...deps, getUserMedia: () => Promise.reject(new Error('no microphone')) }

    await expect(listenToMicrophone(api, () => undefined, { deps: failing })).rejects.toThrow()

    expect(calls.at(-1)).toBe('setOpen:false')
  })
})
