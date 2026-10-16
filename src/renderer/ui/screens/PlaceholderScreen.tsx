import { t, type MessageKey } from '@renderer/i18n'
import { isImmersive, nextScreen, useNavigation, type Screen } from '../navigation'

interface Props {
  screen: Screen
  title: MessageKey
}

// Stands in for a screen that is built in a later task.
export function PlaceholderScreen({ screen, title }: Props): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const next = nextScreen(screen)

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-semibold">{t(title)}</h1>
      <div className="flex gap-3">
        {isImmersive(screen) && (
          <button
            type="button"
            onClick={() => go('home')}
            className="rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
          >
            {t('screen.exit')}
          </button>
        )}
        {next && (
          <button
            type="button"
            onClick={() => go(next)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-white"
          >
            {t('screen.next')}
          </button>
        )}
      </div>
    </section>
  )
}
