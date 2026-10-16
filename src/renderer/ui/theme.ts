import { create } from 'zustand'

export type ThemePreference = 'dark' | 'light' | 'system'
export type Theme = 'dark' | 'light'

export const THEME_PREFERENCES: readonly ThemePreference[] = ['dark', 'light', 'system']

export const resolveTheme = (preference: ThemePreference, systemPrefersDark: boolean): Theme => {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

export const nextPreference = (preference: ThemePreference): ThemePreference =>
  THEME_PREFERENCES[(THEME_PREFERENCES.indexOf(preference) + 1) % THEME_PREFERENCES.length] ??
  'dark'

interface ThemeState {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

// Dark by default: it reduces glare and makes the video stand out.
export const useTheme = create<ThemeState>((set) => ({
  preference: 'dark',
  setPreference: (preference) => set({ preference })
}))
