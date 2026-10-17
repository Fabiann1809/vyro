import { describe, expect, it } from 'vitest'
import { MicrophoneGate, mayCheckMedia, mayOpenMedia, type MediaRequest } from './mediaPermissions'

const request = (changes: Partial<MediaRequest> = {}): MediaRequest => ({
  permission: 'media',
  mediaTypes: ['video'],
  fromApp: true,
  microphoneOpen: false,
  ...changes
})

describe('mayOpenMedia', () => {
  it('lets the app open the camera', () => {
    expect(mayOpenMedia(request())).toBe(true)
  })

  it('does not let the app open the microphone unless a skill that listens is open', () => {
    expect(mayOpenMedia(request({ mediaTypes: ['audio'] }))).toBe(false)
    expect(mayOpenMedia(request({ mediaTypes: ['audio', 'video'] }))).toBe(false)
    expect(mayOpenMedia(request({ mediaTypes: ['audio'], microphoneOpen: true }))).toBe(true)
    expect(mayOpenMedia(request({ mediaTypes: ['video', 'audio'], microphoneOpen: true }))).toBe(
      true
    )
  })

  it('never lets anything outside the app in, whatever is open', () => {
    expect(mayOpenMedia(request({ fromApp: false }))).toBe(false)
    expect(
      mayOpenMedia(request({ mediaTypes: ['audio'], microphoneOpen: true, fromApp: false }))
    ).toBe(false)
  })

  it.each([
    'geolocation',
    'notifications',
    'midi',
    'clipboard-read',
    'display-capture',
    'audioCapture',
    'videoCapture'
  ])('denies the permission "%s"', (permission) => {
    expect(mayOpenMedia(request({ permission, microphoneOpen: true }))).toBe(false)
  })

  it('denies a request that does not say what it opens, or opens something else', () => {
    expect(mayOpenMedia(request({ mediaTypes: undefined, microphoneOpen: true }))).toBe(false)
    expect(mayOpenMedia(request({ mediaTypes: [], microphoneOpen: true }))).toBe(false)
    expect(mayOpenMedia(request({ mediaTypes: ['screen'], microphoneOpen: true }))).toBe(false)
    expect(mayOpenMedia(request({ mediaTypes: ['video', 'screen'], microphoneOpen: true }))).toBe(
      false
    )
  })
})

describe('mayCheckMedia', () => {
  it('answers about the camera and unspecific questions for the app', () => {
    expect(mayCheckMedia('media', true, 'video', false)).toBe(true)
    expect(mayCheckMedia('media', true, 'unknown', false)).toBe(true)
  })

  it('says no about the microphone unless a skill that listens is open', () => {
    expect(mayCheckMedia('media', true, 'audio', false)).toBe(false)
    expect(mayCheckMedia('media', true, 'audio', true)).toBe(true)
  })

  it('says no to anything outside the app or other than media', () => {
    expect(mayCheckMedia('media', false, 'video', true)).toBe(false)
    expect(mayCheckMedia('geolocation', true, undefined, true)).toBe(false)
  })
})

describe('MicrophoneGate', () => {
  it('is closed until a skill that listens is opened, and closed again after', () => {
    const gate = new MicrophoneGate()
    expect(gate.isOpen).toBe(false)

    gate.set(true)
    expect(gate.isOpen).toBe(true)

    gate.set(false)
    expect(gate.isOpen).toBe(false)
  })
})
