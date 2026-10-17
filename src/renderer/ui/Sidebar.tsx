import { t, type MessageKey } from '@renderer/i18n'
import { Icon } from './kit/Icon'
import type { IconName } from './kit/icons'
import { navHome, NAV_SCREENS, useNavigation, type Screen } from './navigation'
import { useSettings } from './settingsStore'
import { useSidebar } from './sidebarStore'
import { resolveTheme, useTheme } from './theme'
import { changeTheme } from './themeTransition'

const DESTINATIONS: Partial<Record<Screen, { label: MessageKey; icon: IconName }>> = {
  home: { label: 'nav.home', icon: 'chat' },
  dashboard: { label: 'nav.dashboard', icon: 'chart' },
  path: { label: 'nav.path', icon: 'route' },
  library: { label: 'nav.library', icon: 'library' },
  settings: { label: 'nav.settings', icon: 'settings' }
}

const ITEM =
  'flex h-11 items-center gap-3 rounded-2xl px-3.5 text-left text-sm whitespace-nowrap transition-colors hover:bg-line/5 hover:text-t1 aria-[current=page]:bg-line/7 aria-[current=page]:text-t1 text-mut'

// The dark theme is the default, so "toggle" means the one the person is not seeing now.
function useThemeToggle(): { toLight: boolean; toggle: () => void } {
  const preference = useTheme((state) => state.preference)
  const seen = resolveTheme(preference, window.matchMedia('(prefers-color-scheme: dark)').matches)
  return {
    toLight: seen === 'dark',
    toggle: () => changeTheme(seen === 'dark' ? 'light' : 'dark')
  }
}

export function Sidebar(): React.JSX.Element {
  const { screen, go } = useNavigation()
  const { collapsed, toggle: toggleSidebar } = useSidebar()
  const aiEnabled = useSettings((state) => state.aiEnabled)
  const theme = useThemeToggle()
  const current = navHome(screen)
  const expanded = !collapsed

  // The lab holds the recorder used to make fixtures, so it only exists in development.
  const labLink = import.meta.env.DEV

  const item = (target: Screen, label: MessageKey, icon: IconName): React.JSX.Element => (
    <button
      key={target}
      type="button"
      aria-current={target === current ? 'page' : undefined}
      aria-label={t(label)}
      title={t(label)}
      onClick={() => go(target)}
      className={ITEM}
    >
      <Icon name={icon} />
      {expanded && <span>{t(label)}</span>}
    </button>
  )

  const themeLabel = t(theme.toLight ? 'nav.theme.toLight' : 'nav.theme.toDark')

  return (
    <nav
      aria-label={t('nav.label')}
      className={`flex shrink-0 flex-col gap-1 overflow-hidden border-r border-line/6 bg-side px-3.5 py-5 transition-[width] duration-200 ease-out ${expanded ? 'w-60' : 'w-19'}`}
    >
      <div className="flex items-center gap-3 px-1.5 pb-6">
        <div
          aria-hidden="true"
          className="flex size-8.5 shrink-0 items-center justify-center rounded-xl bg-brand"
        >
          <div className="size-3.5 rounded-full border-[3px] border-on-brand" />
        </div>
        {expanded && <span className="font-display text-lg font-bold tracking-[0.08em]">VYRO</span>}
      </div>

      {NAV_SCREENS.map((target) => {
        const destination = DESTINATIONS[target]
        return destination ? item(target, destination.label, destination.icon) : null
      })}
      {labLink && item('lab', 'nav.lab', 'object')}

      <div className="flex-1" />

      {item('how', 'nav.how', 'info')}

      {expanded && (
        <div className="mx-0 my-2 flex flex-col gap-2.5 rounded-2xl border border-line/6 bg-card p-3.5">
          <p className="flex items-center gap-2 text-[0.8125rem] font-semibold">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${aiEnabled ? 'bg-brand' : 'bg-mut3'}`}
            />
            {t(aiEnabled ? 'nav.ai.on' : 'nav.ai.off')}
          </p>
          <p className="text-xs leading-snug text-mut">{t('nav.privacy')}</p>
        </div>
      )}

      <button
        type="button"
        onClick={theme.toggle}
        aria-label={themeLabel}
        title={themeLabel}
        className={`${ITEM} h-10`}
      >
        <Icon name={theme.toLight ? 'sun' : 'moon'} />
        {expanded && <span>{t(theme.toLight ? 'nav.theme.light' : 'nav.theme.dark')}</span>}
      </button>

      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={t(expanded ? 'nav.collapse' : 'nav.expand')}
        aria-expanded={expanded}
        title={t(expanded ? 'nav.collapse' : 'nav.expand')}
        className="flex h-9 items-center justify-center rounded-xl text-mut3 hover:bg-line/5 hover:text-t1"
      >
        <Icon
          name="chevron"
          className={`size-4.5 transition-transform duration-200 ${expanded ? '' : 'rotate-180'}`}
          strokeWidth={1.8}
        />
      </button>
    </nav>
  )
}
