import { describe, expect, it, vi } from 'vitest'
import {
  buildCameraConstraints,
  classifyCameraError,
  listVideoInputs,
  openCamera,
  stopStream
} from './camera'

function fakeDevice(kind: MediaDeviceKind, deviceId: string, label: string): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: '', toJSON: () => ({}) }
}

describe('listVideoInputs', () => {
  it('keeps only cameras and drops microphones and speakers', async () => {
    const devices = {
      enumerateDevices: async () => [
        fakeDevice('audioinput', 'mic', 'Microphone'),
        fakeDevice('videoinput', 'cam-1', 'Integrated camera'),
        fakeDevice('audiooutput', 'spk', 'Speakers'),
        fakeDevice('videoinput', 'cam-2', 'Phone webcam')
      ]
    }

    expect(await listVideoInputs(devices)).toEqual([
      { deviceId: 'cam-1', label: 'Integrated camera' },
      { deviceId: 'cam-2', label: 'Phone webcam' }
    ])
  })

  it('returns an empty list when there are no cameras', async () => {
    expect(await listVideoInputs({ enumerateDevices: async () => [] })).toEqual([])
  })
})

describe('buildCameraConstraints', () => {
  it('never asks for audio', () => {
    expect(buildCameraConstraints().audio).toBe(false)
  })

  it('does not force a device when none is chosen', () => {
    expect(buildCameraConstraints().video).not.toHaveProperty('deviceId')
  })

  it('requires the chosen device exactly', () => {
    expect(buildCameraConstraints('cam-2').video).toMatchObject({ deviceId: { exact: 'cam-2' } })
  })

  it('asks for 1280x720 at 30 fps as ideal values', () => {
    expect(buildCameraConstraints().video).toMatchObject({
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    })
  })
})

describe('openCamera and stopStream', () => {
  it('opens the stream with the built constraints', async () => {
    const stream = {} as MediaStream
    const getUserMedia = vi.fn().mockResolvedValue(stream)

    await expect(openCamera({ getUserMedia }, 'cam-1')).resolves.toBe(stream)
    expect(getUserMedia).toHaveBeenCalledWith(buildCameraConstraints('cam-1'))
  })

  it('stops every track of the stream', () => {
    const stops = [vi.fn(), vi.fn()]
    const stream = { getTracks: () => stops.map((stop) => ({ stop })) } as unknown as MediaStream

    stopStream(stream)

    stops.forEach((stop) => expect(stop).toHaveBeenCalledOnce())
  })
})

describe('classifyCameraError', () => {
  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['SecurityError', 'permission-denied'],
    ['NotFoundError', 'no-device'],
    ['OverconstrainedError', 'no-device'],
    ['NotReadableError', 'in-use'],
    ['AbortError', 'in-use'],
    ['TypeError', 'unknown']
  ])('maps %s to %s', (name, kind) => {
    expect(classifyCameraError({ name })).toBe(kind)
  })

  it('treats values that are not errors as unknown', () => {
    expect(classifyCameraError(undefined)).toBe('unknown')
    expect(classifyCameraError('boom')).toBe('unknown')
  })
})
