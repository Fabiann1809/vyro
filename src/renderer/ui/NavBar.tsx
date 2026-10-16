import { t, type MessageKey } from '@renderer/i18n'
import { NAV_SCREENS, useNavigation, type Screen } from './navigation'
import { nextPreference, useTheme, type ThemePreference } from './theme'

const LABEL: Partial<Record<Screen, MessageKey>> = {
  home: 'nav.home',
  progress: 'nav.progress',
  settings: 'nav.settings',
  lab: 'nav.lab'
}

const THEME_LABEL: Record<ThemePreference, MessageKey> = {
  dark: 'theme.dark',
  light: 'theme.light',
  system: 'theme.system'
}

export function NavBar(): React.JSX.Element {
  const { screen, go } = useNavigation()
  const { preference, setPreference } = useTheme()
  // The lab holds the recorder used to make fixtures, so it only exists in development.
  const screens: readonly Screen[] = import.meta.env.DEV ? [...NAV_SCREENS, 'lab'] : NAV_SCREENS

  return (
    <nav
      aria-label={t('nav.label')}
      className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800"
    >
      {screens.map((target) => (
        <button
          key={target}
          type="button"
          aria-current={target === screen ? 'page' : undefined}
          onClick={() => go(target)}
          className="rounded-md px-3 py-1.5 text-sm hover:bg-slate-200 aria-[current=page]:bg-slate-200 aria-[current=page]:font-semibold dark:hover:bg-slate-800 dark:aria-[current=page]:bg-slate-800"
        >
          {t(LABEL[target] ?? 'nav.home')}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setPreference(nextPreference(preference))}
        className="ml-auto rounded-md px-3 py-1.5 text-sm hover:bg-slate-200 dark:hover:bg-slate-800"
      >
        {t('theme.label', { theme: t(THEME_LABEL[preference]) })}
      </button>
    </nav>
  )
}
