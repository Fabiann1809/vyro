import { create } from 'zustand'

export type ThemePreference = 'dark' | 'light' | 'system'
export type Theme = 'dark' | 'light'

export const THEME_PREFERENCES: readonly ThemePreference[] = ['dark', 'light', 'system']

export const resolveTheme = (preference: ThemePreference, systemPrefersDark: boolean): Theme => {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

interface ThemeState {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

// Dark by default: it reduces glare and makes the video stand out.
export const useTheme = create<ThemeState>((set) => ({
  preference: 'dark',
  setPreference: (preference) => set({ preference })
}))
