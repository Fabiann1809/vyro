import { create } from 'zustand'

export type Screen =
  | 'home'
  | 'dashboard'
  | 'path'
  | 'library'
  | 'how'
  | 'calibration'
  | 'training'
  | 'summary'
  | 'skillNew'
  | 'settings'
  | 'lab'

// Screens reached from the side bar.
export const NAV_SCREENS: readonly Screen[] = ['home', 'dashboard', 'path', 'library', 'settings']

// The user is standing in front of the camera: no navigation, only a way out.
const IMMERSIVE_SCREENS: readonly Screen[] = ['calibration', 'training']

export const isImmersive = (screen: Screen): boolean => IMMERSIVE_SCREENS.includes(screen)

// The destination of the side bar that a screen belongs to, so that it stays marked while the
// person is in a screen that hangs from it.
export function navHome(screen: Screen): Screen {
  if (screen === 'summary') return 'dashboard'
  if (screen === 'skillNew') return 'library'
  return screen
}

// Where leaving a screen that was entered from another one goes back to: the place the person
// came from, if it is one of the main destinations, and the library otherwise.
export function returnTarget(previous: Screen | null): Screen {
  return previous !== null && NAV_SCREENS.includes(previous) && previous !== 'settings'
    ? previous
    : 'library'
}

interface NavigationState {
  screen: Screen
  // The screen the person was in before this one.
  previous: Screen | null
  go: (screen: Screen) => void
}

export const useNavigation = create<NavigationState>((set) => ({
  screen: 'home',
  previous: null,
  go: (screen) => set((state) => ({ screen, previous: state.screen }))
}))
