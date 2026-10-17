import { useSettings } from './settingsStore'
import { resolveTheme, useTheme, type ThemePreference } from './theme'

type WithViewTransition = Document & { startViewTransition?: (update: () => void) => unknown }

// Changes the theme with a soft cross-fade of the whole window. The theme attribute is set inside the
// fade, so that what fades is the change itself; with less motion asked for it just changes.
export function changeTheme(preference: ThemePreference): void {
  const apply = (): void => {
    document.documentElement.dataset.theme = resolveTheme(
      preference,
      window.matchMedia('(prefers-color-scheme: dark)').matches
    )
    useTheme.getState().setPreference(preference)
  }
  const doc = document as WithViewTransition
  const lessMotion =
    useSettings.getState().reduceMotion ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (doc.startViewTransition && !lessMotion) doc.startViewTransition(apply)
  else apply()
}
