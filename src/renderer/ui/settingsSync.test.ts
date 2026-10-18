import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { DEFAULT_SETTINGS, type AppSettings, type SettingsPatch } from '@shared/settings'
import { applySettings, deleteAllData, diffSettings, startSettingsSync } from './settingsSync'

interface FakeApi {
  settings: {
    get: Mock<() => Promise<AppSettings>>
    set: Mock<(patch: SettingsPatch) => Promise<void>>
  }
  data: { deleteAll: Mock<() => Promise<void>> }
  skills: { listCustom: Mock<() => Promise<never[]>> }
}

function fakeApi(stored: AppSettings = DEFAULT_SETTINGS): FakeApi {
  return {
    settings: {
      get: vi.fn(() => Promise.resolve(stored)),
      set: vi.fn<(patch: SettingsPatch) => Promise<void>>(() => Promise.resolve())
    },
    data: { deleteAll: vi.fn(() => Promise.resolve()) },
    skills: { listCustom: vi.fn(() => Promise.resolve([])) }
  }
}

beforeEach(() => applySettings(DEFAULT_SETTINGS))

describe('diffSettings', () => {
  it('lists only what changed', () => {
    expect(
      diffSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, theme: 'light', volume: 0.1 })
    ).toEqual({
      theme: 'light',
      volume: 0.1
    })
  })

  it('is empty when nothing changed', () => {
    expect(diffSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS })).toEqual({})
  })
})

describe('startSettingsSync', () => {
  it('applies the saved settings without saving them again', async () => {
    const api = fakeApi({ ...DEFAULT_SETTINGS, language: 'en', theme: 'light', volume: 0.2 })

    await startSettingsSync(api)

    const { useSettings } = await import('./settingsStore')
    const { useTheme } = await import('./theme')
    expect(useSettings.getState()).toMatchObject({ language: 'en', volume: 0.2 })
    expect(useTheme.getState().preference).toBe('light')
    expect(api.settings.set).not.toHaveBeenCalled()
  })

  it('saves what the user changes, and only that', async () => {
    const api = fakeApi()
    await startSettingsSync(api)
    const { useSettings } = await import('./settingsStore')

    useSettings.getState().setVoiceEnabled(false)

    expect(api.settings.set).toHaveBeenCalledWith({ voiceEnabled: false })
  })

  it('saves the hand control when it is turned off, and applies it when it is loaded', async () => {
    const api = fakeApi()
    await startSettingsSync(api)
    const { useSettings } = await import('./settingsStore')

    useSettings.getState().setHandControl(false)

    expect(api.settings.set).toHaveBeenCalledWith({ handControl: false })

    await startSettingsSync(fakeApi({ ...DEFAULT_SETTINGS, handControl: true }))
    expect(useSettings.getState().handControl).toBe(true)
  })

  it('saves a theme change too', async () => {
    const api = fakeApi()
    await startSettingsSync(api)
    const { useTheme } = await import('./theme')

    useTheme.getState().setPreference('system')

    expect(api.settings.set).toHaveBeenCalledWith({ theme: 'system' })
  })

  it('keeps going with the defaults when the settings cannot be loaded', async () => {
    const api = fakeApi()
    api.settings.get.mockRejectedValueOnce(new Error('no database'))

    await expect(startSettingsSync(api)).resolves.toBeUndefined()
  })
})

describe('deleteAllData', () => {
  it('empties the database and goes back to the defaults without saving them', async () => {
    const api = fakeApi()
    await startSettingsSync(api)
    const { useSettings } = await import('./settingsStore')
    useSettings.getState().setVolume(0.1)
    api.settings.set.mockClear()

    await deleteAllData(api)

    expect(api.data.deleteAll).toHaveBeenCalledOnce()
    expect(useSettings.getState().volume).toBe(DEFAULT_SETTINGS.volume)
    expect(api.settings.set).not.toHaveBeenCalled()
  })
})
