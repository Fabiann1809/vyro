import { create } from 'zustand'
import { setLanguage } from '@renderer/i18n'
import type { AiProviderId } from '@shared/aiProviders'
import { DEFAULT_SETTINGS, type Language, type TextSize } from '@shared/settings'

interface SettingsState {
  language: Language
  voiceEnabled: boolean
  // 0..1
  volume: number
  // The camera the user chose; null means the system default.
  cameraId: string | null
  audioDeviceId: string | null
  textSize: TextSize
  reduceMotion: boolean
  aiEnabled: boolean
  aiConsent: boolean
  aiDailyTokenLimit: number
  aiProvider: AiProviderId
  aiModel: string | null
  aiBaseUrl: string | null
  setLanguage: (language: Language) => void
  setVoiceEnabled: (enabled: boolean) => void
  setVolume: (volume: number) => void
  setCameraId: (cameraId: string | null) => void
  setAudioDeviceId: (audioDeviceId: string | null) => void
  setTextSize: (textSize: TextSize) => void
  setReduceMotion: (reduceMotion: boolean) => void
  setAiEnabled: (aiEnabled: boolean) => void
  setAiConsent: (aiConsent: boolean) => void
  setAiDailyTokenLimit: (aiDailyTokenLimit: number) => void
  setAiProvider: (aiProvider: AiProviderId) => void
  setAiModel: (aiModel: string | null) => void
  setAiBaseUrl: (aiBaseUrl: string | null) => void
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export const useSettings = create<SettingsState>((set) => ({
  language: DEFAULT_SETTINGS.language,
  voiceEnabled: DEFAULT_SETTINGS.voiceEnabled,
  volume: DEFAULT_SETTINGS.volume,
  cameraId: DEFAULT_SETTINGS.cameraId,
  audioDeviceId: DEFAULT_SETTINGS.audioDeviceId,
  textSize: DEFAULT_SETTINGS.textSize,
  reduceMotion: DEFAULT_SETTINGS.reduceMotion,
  aiEnabled: DEFAULT_SETTINGS.aiEnabled,
  aiConsent: DEFAULT_SETTINGS.aiConsent,
  aiDailyTokenLimit: DEFAULT_SETTINGS.aiDailyTokenLimit,
  aiProvider: DEFAULT_SETTINGS.aiProvider,
  aiModel: DEFAULT_SETTINGS.aiModel,
  aiBaseUrl: DEFAULT_SETTINGS.aiBaseUrl,
  // The texts change in the same instant, before the screens draw again.
  setLanguage: (language) => {
    setLanguage(language)
    set({ language })
  },
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setVolume: (volume) => set({ volume: clamp01(volume) }),
  setCameraId: (cameraId) => set({ cameraId }),
  setAudioDeviceId: (audioDeviceId) => set({ audioDeviceId }),
  setTextSize: (textSize) => set({ textSize }),
  setReduceMotion: (reduceMotion) => set({ reduceMotion }),
  setAiEnabled: (aiEnabled) => set({ aiEnabled }),
  setAiConsent: (aiConsent) => set({ aiConsent }),
  setAiDailyTokenLimit: (aiDailyTokenLimit) => set({ aiDailyTokenLimit }),
  setAiProvider: (aiProvider) => set({ aiProvider }),
  setAiModel: (aiModel) => set({ aiModel }),
  setAiBaseUrl: (aiBaseUrl) => set({ aiBaseUrl })
}))
