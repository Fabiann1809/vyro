import { create } from 'zustand'

export type Language = 'es' | 'en'

export const LANGUAGES: readonly Language[] = ['es', 'en']

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
  language: 'es',
  voiceEnabled: true,
  volume: 0.8,
  cameraId: null,
  setLanguage: (language) => set({ language }),
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setVolume: (volume) => set({ volume: clamp01(volume) }),
  setCameraId: (cameraId) => set({ cameraId })
}))
