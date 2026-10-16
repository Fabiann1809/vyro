import type { VyroApi } from '@shared/ipc'
import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  type AppSettings,
  type SettingsPatch
} from '@shared/settings'
import { useSettings } from './settingsStore'
import { useTheme } from './theme'

type SettingsApi = Pick<VyroApi, 'settings' | 'data'>

export function currentSettings(): AppSettings {
  const { language, voiceEnabled, volume, cameraId } = useSettings.getState()
  return { language, voiceEnabled, volume, cameraId, theme: useTheme.getState().preference }
}

// What changed between two states of the settings; empty when nothing did.
export function diffSettings(previous: AppSettings, next: AppSettings): SettingsPatch {
  const patch: Record<string, unknown> = {}
  for (const key of SETTING_KEYS) {
    if (previous[key] !== next[key]) patch[key] = next[key]
  }
  return patch as SettingsPatch
}

// While settings are being loaded they must not be saved back as if the user had changed them.
let applying = false

export function applySettings(settings: AppSettings): void {
  applying = true
  try {
    const store = useSettings.getState()
    store.setLanguage(settings.language)
    store.setVoiceEnabled(settings.voiceEnabled)
    store.setVolume(settings.volume)
    store.setCameraId(settings.cameraId)
    useTheme.getState().setPreference(settings.theme)
  } finally {
    applying = false
  }
}

// Loads the saved settings, and from then on saves every change the user makes. A failure to
// load leaves the defaults; a failure to save is not worth interrupting a workout for.
export async function startSettingsSync(api: SettingsApi): Promise<void> {
  try {
    applySettings(await api.settings.get())
  } catch {
    applySettings(DEFAULT_SETTINGS)
  }

  let saved = currentSettings()
  const save = (): void => {
    if (applying) return
    const next = currentSettings()
    const patch = diffSettings(saved, next)
    saved = next
    if (Object.keys(patch).length > 0) api.settings.set(patch).catch(() => undefined)
  }
  useSettings.subscribe(save)
  useTheme.subscribe(save)
}

// Empties the database and goes back to the default settings, which are not saved again.
export async function deleteAllData(api: SettingsApi): Promise<void> {
  await api.data.deleteAll()
  applySettings(DEFAULT_SETTINGS)
}
