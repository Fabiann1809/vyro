import { create } from 'zustand'
import { setLanguage } from '@renderer/i18n'
import { DEFAULT_SETTINGS, type Language } from '@shared/settings'

interface SettingsState {
  language: Language
  voiceEnabled: boolean
  // 0..1
  volume: number
  // The camera the user chose; null means the system default.
  cameraId: string | null
  setLanguage: (language: Language) => void
  setVoiceEnabled: (enabled: boolean) => void
  setVolume: (volume: number) => void
  setCameraId: (cameraId: string | null) => void
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export const useSettings = create<SettingsState>((set) => ({
  language: DEFAULT_SETTINGS.language,
  voiceEnabled: DEFAULT_SETTINGS.voiceEnabled,
  volume: DEFAULT_SETTINGS.volume,
  cameraId: DEFAULT_SETTINGS.cameraId,
  // The texts change in the same instant, before the screens draw again.
  setLanguage: (language) => {
    setLanguage(language)
    set({ language })
  },
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setVolume: (volume) => set({ volume: clamp01(volume) }),
  setCameraId: (cameraId) => set({ cameraId })
}))
