import { useEffect } from 'react'
import { resolveTheme, useTheme } from './theme'

// Puts the resolved theme on the root element, where the styles read it.
export function useAppliedTheme(): void {
  const preference = useTheme((state) => state.preference)

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      document.documentElement.dataset.theme = resolveTheme(preference, query.matches)
    }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [preference])
}
