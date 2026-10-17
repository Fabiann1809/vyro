import { create } from 'zustand'

export type Screen =
  | 'home'
  | 'calibration'
  | 'training'
  | 'summary'
  | 'progress'
  | 'path'
  | 'coach'
  | 'settings'
  | 'lab'

// Screens reached from the top navigation.
export const NAV_SCREENS: readonly Screen[] = ['home', 'progress', 'path', 'coach', 'settings']

// The user is standing in front of the camera: no navigation, only a way out.
const IMMERSIVE_SCREENS: readonly Screen[] = ['calibration', 'training']

export const isImmersive = (screen: Screen): boolean => IMMERSIVE_SCREENS.includes(screen)

interface NavigationState {
  screen: Screen
  go: (screen: Screen) => void
}

export const useNavigation = create<NavigationState>((set) => ({
  screen: 'home',
  go: (screen) => set({ screen })
}))
