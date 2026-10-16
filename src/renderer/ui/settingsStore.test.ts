import { beforeEach, describe, expect, it } from 'vitest'
import { useSettings } from './settingsStore'

describe('settings store', () => {
  beforeEach(() =>
    useSettings.setState({ language: 'es', voiceEnabled: true, volume: 0.8, cameraId: null })
  )

  it('starts in Spanish with the voice on', () => {
    const { language, voiceEnabled, cameraId } = useSettings.getState()

    expect({ language, voiceEnabled, cameraId }).toEqual({
      language: 'es',
      voiceEnabled: true,
      cameraId: null
    })
  })

  it('applies every change right away', () => {
    const settings = useSettings.getState()
    settings.setLanguage('en')
    settings.setVoiceEnabled(false)
    settings.setVolume(0.3)
    settings.setCameraId('cam-2')

    expect(useSettings.getState()).toMatchObject({
      language: 'en',
      voiceEnabled: false,
      volume: 0.3,
      cameraId: 'cam-2'
    })
  })

  it('keeps the volume between 0 and 1', () => {
    useSettings.getState().setVolume(1.7)
    expect(useSettings.getState().volume).toBe(1)

    useSettings.getState().setVolume(-1)
    expect(useSettings.getState().volume).toBe(0)
  })
})
