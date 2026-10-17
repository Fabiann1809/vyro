import { t } from '@renderer/i18n'
import { Button } from '../kit/Button'
import { Icon } from '../kit/Icon'

// The top of the dashboard: the streak of days, and the one thing to do next with a button to do it.
export function StreakStrip({
  streak,
  next,
  onContinue,
  onLibrary
}: {
  streak: number
  // What is next in the path being followed; null when there is no path.
  next: { title: string; step: number; total: number } | null
  onContinue: () => void
  onLibrary: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-7 rounded-3xl border border-line/7 bg-linear-to-r from-brand/12 via-card to-card px-6.5 py-5.5">
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-13 items-center justify-center rounded-2xl bg-brand text-on-brand"
        >
          <Icon name="flame" className="size-6.5" strokeWidth={1.7} />
        </span>
        <div>
          {streak > 0 ? (
            <>
              <p className="font-display text-[1.625rem] leading-none font-semibold">
                {t('dashboard.streak.days', { count: streak })}
              </p>
              <p className="mt-1 text-[0.84rem] text-t4">{t('dashboard.streak.caption')}</p>
            </>
          ) : (
            <>
              <p className="text-lg leading-none font-semibold">{t('dashboard.streak.none')}</p>
              <p className="mt-1 text-[0.84rem] text-t4">{t('dashboard.streak.start')}</p>
            </>
          )}
        </div>
      </div>
      <span aria-hidden="true" className="hidden w-px self-stretch bg-line/8 sm:block" />
      <div className="min-w-60 flex-1">
        <p className="text-[0.8125rem] text-mut">{t('dashboard.next.label')}</p>
        <p className="mt-1 text-lg font-semibold">
          {next
            ? t('dashboard.next.step', { title: next.title, step: next.step, total: next.total })
            : t('dashboard.next.none')}
        </p>
      </div>
      {next ? (
        <Button size="lg" onClick={onContinue}>
          {t('dashboard.next.continue')} <span aria-hidden="true">→</span>
        </Button>
      ) : (
        <Button size="lg" onClick={onLibrary}>
          {t('dashboard.next.library')} <span aria-hidden="true">→</span>
        </Button>
      )}
    </div>
  )
}
