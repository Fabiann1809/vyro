import { create } from 'zustand'
import { setLanguage } from '@renderer/i18n'
import { DEFAULT_SETTINGS, type Language, type TextSize } from '@shared/settings'

interface SettingsState {
  language: Language
  voiceEnabled: boolean
  // 0..1
  volume: number
  // The camera the user chose; null means the system default.
  cameraId: string | null
  textSize: TextSize
  reduceMotion: boolean
  setLanguage: (language: Language) => void
  setVoiceEnabled: (enabled: boolean) => void
  setVolume: (volume: number) => void
  setCameraId: (cameraId: string | null) => void
  setTextSize: (textSize: TextSize) => void
  setReduceMotion: (reduceMotion: boolean) => void
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export const useSettings = create<SettingsState>((set) => ({
  language: DEFAULT_SETTINGS.language,
  voiceEnabled: DEFAULT_SETTINGS.voiceEnabled,
  volume: DEFAULT_SETTINGS.volume,
  cameraId: DEFAULT_SETTINGS.cameraId,
  textSize: DEFAULT_SETTINGS.textSize,
  reduceMotion: DEFAULT_SETTINGS.reduceMotion,
  // The texts change in the same instant, before the screens draw again.
  setLanguage: (language) => {
    setLanguage(language)
    set({ language })
  },
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setVolume: (volume) => set({ volume: clamp01(volume) }),
  setCameraId: (cameraId) => set({ cameraId }),
  setTextSize: (textSize) => set({ textSize }),
  setReduceMotion: (reduceMotion) => set({ reduceMotion })
}))
