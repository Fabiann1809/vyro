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

// An item of the bar: an orb with the icon and, when the bar is open, the name. The page where the
// person is lights up: a faint gradient behind it and the orb in the colour of the brand.
const ITEM =
  'group flex h-12.5 items-center gap-3 rounded-[1.125rem] border border-transparent px-2 text-left text-[0.9rem] font-semibold whitespace-nowrap text-mut transition-all duration-200 hover:bg-line/7 hover:text-t1 aria-[current=page]:border-brand/35 aria-[current=page]:bg-linear-to-br aria-[current=page]:from-brand/20 aria-[current=page]:to-ch-hands/10 aria-[current=page]:text-t1'
const ORB =
  'flex size-8.5 shrink-0 items-center justify-center rounded-xl bg-line/6 transition-all duration-200 group-aria-[current=page]:bg-grad group-aria-[current=page]:text-on-brand group-aria-[current=page]:shadow-[0_8px_22px_-8px_oklch(0.7_0.18_40/0.8)]'

// The dark theme is the default, so "toggle" means the one the person is not seeing now.
function useThemeToggle(): { toLight: boolean; toggle: () => void } {
  const preference = useTheme((state) => state.preference)
  const seen = resolveTheme(preference, window.matchMedia('(prefers-color-scheme: dark)').matches)
  return {
    toLight: seen === 'dark',
    toggle: () => changeTheme(seen === 'dark' ? 'light' : 'dark')
  }
}

// The mark of the app: a rounded square in the colour of the brand with a ring and a pulse that is
// drawn once when the bar appears.
function Mark(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="size-9.5 shrink-0 drop-shadow-[0_6px_16px_oklch(0.65_0.18_40/0.55)]"
    >
      <defs>
        <linearGradient id="vy-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFD1A0" />
          <stop offset="0.5" stopColor="#F27A3E" />
          <stop offset="1" stopColor="#A8326A" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="13" fill="url(#vy-mark)" />
      <circle cx="20" cy="20" r="10" fill="none" stroke="#2A0F1A" strokeWidth="2.6" />
      <path
        d="M5.5 20h6.5l2.2-4.5 3.6 10 3.4-12 3 8.5 1.6-2h8.7"
        fill="none"
        stroke="#FFF6EE"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="60"
        strokeDashoffset="60"
        style={{ animation: 'vy-draw 1.4s 200ms cubic-bezier(0.3, 0.7, 0.2, 1) forwards' }}
      />
    </svg>
  )
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
      <span className={ORB}>
        <Icon name={icon} className="size-4.75" />
      </span>
      {expanded && <span>{t(label)}</span>}
    </button>
  )

  const themeLabel = t(theme.toLight ? 'nav.theme.toLight' : 'nav.theme.toDark')

  return (
    <nav
      aria-label={t('nav.label')}
      className={`relative z-10 flex shrink-0 flex-col gap-1.5 overflow-hidden rounded-[1.875rem] border border-line/10 bg-(--glass-side) px-3 py-4 shadow-(--glass-shadow) backdrop-blur-[28px] backdrop-saturate-150 transition-[width] duration-300 ease-out ${expanded ? 'w-59' : 'w-19.5'}`}
    >
      <div className="flex items-center gap-3 px-1.5 pt-0.5 pb-5">
        <Mark />
        {expanded && (
          <div className="flex flex-col">
            <span className="font-display text-xl leading-none font-extrabold tracking-[0.16em]">
              VYRO
            </span>
            <span className="mt-1 text-[0.6875rem] tracking-[0.04em] text-mut">
              {t('nav.tagline')}
            </span>
          </div>
        )}
      </div>

      {NAV_SCREENS.map((target) => {
        const destination = DESTINATIONS[target]
        return destination ? item(target, destination.label, destination.icon) : null
      })}
      {labLink && item('lab', 'nav.lab', 'object')}

      <div className="flex-1" />

      {item('how', 'nav.how', 'info')}

      {expanded && (
        <div className="mt-2 mb-1.5 flex flex-col gap-2 rounded-[1.25rem] border border-line/8 bg-line/5 p-3.5">
          <p className="flex items-center gap-2 text-[0.8125rem] font-semibold">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${aiEnabled ? 'bg-good shadow-[0_0_10px_var(--good)]' : 'bg-mut3'}`}
            />
            {t(aiEnabled ? 'nav.ai.on' : 'nav.ai.off')}
          </p>
          <p className="text-[0.71875rem] leading-snug text-mut">{t('nav.privacy')}</p>
        </div>
      )}

      <button
        type="button"
        onClick={theme.toggle}
        aria-label={themeLabel}
        title={themeLabel}
        className={`${ITEM} h-11`}
      >
        <span className="flex size-8.5 shrink-0 items-center justify-center">
          <Icon name={theme.toLight ? 'sun' : 'moon'} />
        </span>
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
