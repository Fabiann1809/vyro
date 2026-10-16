import { useEffect } from 'react'
import { rootFontSize } from './appearance'
import { useSettings } from './settingsStore'
import { resolveTheme, useTheme } from './theme'

// Puts the theme, the text size and the reduced-motion choice on the root element, where the
// styles read them.
export function useAppliedAppearance(): void {
  const preference = useTheme((state) => state.preference)
  const textSize = useSettings((state) => state.textSize)
  const reduceMotion = useSettings((state) => state.reduceMotion)

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      document.documentElement.dataset.theme = resolveTheme(preference, query.matches)
    }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [preference])

  useEffect(() => {
    document.documentElement.style.fontSize = rootFontSize(textSize)
  }, [textSize])

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion)
  }, [reduceMotion])
}
