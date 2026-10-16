import { create } from 'zustand'

export type Screen =
  'home' | 'calibration' | 'training' | 'summary' | 'progress' | 'settings' | 'lab'

// Screens reached from the top navigation.
export const NAV_SCREENS: readonly Screen[] = ['home', 'progress', 'settings']

// The user is standing in front of the camera: no navigation, only a way out.
const IMMERSIVE_SCREENS: readonly Screen[] = ['calibration', 'training']

// The step that follows in a session: home, calibration, training, summary and back home.
const NEXT_SCREEN: Partial<Record<Screen, Screen>> = {
  home: 'calibration',
  calibration: 'training',
  training: 'summary',
  summary: 'home'
}

export const isImmersive = (screen: Screen): boolean => IMMERSIVE_SCREENS.includes(screen)

export const nextScreen = (screen: Screen): Screen | null => NEXT_SCREEN[screen] ?? null

interface NavigationState {
  screen: Screen
  go: (screen: Screen) => void
}

export const useNavigation = create<NavigationState>((set) => ({
  screen: 'home',
  go: (screen) => set({ screen })
}))
