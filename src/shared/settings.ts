import { z } from 'zod'
import { AI_PROVIDER_IDS, isSafeAiBaseUrl, type AiProviderId } from './aiProviders'

export type Language = 'es' | 'en'
export type ThemePreference = 'dark' | 'light' | 'system'
export type TextSize = 'normal' | 'large' | 'extra-large'

export interface AppSettings {
  language: Language
  voiceEnabled: boolean
  // 0..1
  volume: number
  // The camera the user chose; null means the system default.
  cameraId: string | null
  theme: ThemePreference
  textSize: TextSize
  reduceMotion: boolean
  // The AI coach is off until the user turns it on (and has saved a key).
  aiEnabled: boolean
  // The person read what is sent and to whom, and accepted. Without it nothing is sent.
  aiConsent: boolean
  aiProvider: AiProviderId
  // A model the user typed, for every kind of request; null uses the provider's own choice.
  aiModel: string | null
  // Only for the "custom" provider.
  aiBaseUrl: string | null
}

// Dark by default: it reduces glare and makes the video stand out.
export const DEFAULT_SETTINGS: AppSettings = {
  language: 'es',
  voiceEnabled: true,
  volume: 0.8,
  cameraId: null,
  theme: 'dark',
  textSize: 'normal',
  reduceMotion: false,
  aiEnabled: false,
  aiConsent: false,
  aiProvider: 'claude',
  aiModel: null,
  aiBaseUrl: null
}

// One schema per setting: the same rules check what is stored and what the renderer sends.
export const settingSchemas = {
  language: z.enum(['es', 'en']),
  voiceEnabled: z.boolean(),
  volume: z.number().min(0).max(1),
  cameraId: z.string().min(1).max(512).nullable(),
  theme: z.enum(['dark', 'light', 'system']),
  textSize: z.enum(['normal', 'large', 'extra-large']),
  reduceMotion: z.boolean(),
  aiEnabled: z.boolean(),
  aiConsent: z.boolean(),
  aiProvider: z.enum(AI_PROVIDER_IDS as [AiProviderId, ...AiProviderId[]]),
  aiModel: z.string().trim().min(1).max(100).nullable(),
  aiBaseUrl: z.string().max(300).refine(isSafeAiBaseUrl, 'Not a safe address').nullable()
} satisfies { [K in keyof AppSettings]: z.ZodType<AppSettings[K]> }

export const settingsPatchSchema = z.object(settingSchemas).partial().strict()

export type SettingsPatch = Partial<AppSettings>

export const SETTING_KEYS = Object.keys(settingSchemas) as Array<keyof AppSettings>
