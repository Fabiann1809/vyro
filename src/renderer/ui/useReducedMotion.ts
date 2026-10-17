import { useSettings } from './settingsStore'

// Whether the person asked for less movement, in the settings or in the system.
export function useReducedMotion(): boolean {
  const setting = useSettings((state) => state.reduceMotion)
  return setting || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
