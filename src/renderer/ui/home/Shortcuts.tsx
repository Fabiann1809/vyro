import { currentLanguage, t } from '@renderer/i18n'
import type { WeekDay } from '../dashboardData'
import { CHANNEL_LOOK, CHANNEL_ORDER } from '../kit/channels'
import { ProgressRing } from '../charts/ProgressRing'
import { Icon } from '../kit/Icon'

const CARD =
  'glass flex items-center gap-4 rounded-[1.625rem] p-3.5 pr-4 text-left transition duration-200 hover:-translate-y-0.75 hover:border-line/22'

const Arrow = (): React.JSX.Element => (
  <span
    aria-hidden="true"
    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-line/8"
  >
    <Icon name="arrow" className="size-4" strokeWidth={2} />
  </span>
)

// The three ways in under the empty chat: go back to the path, see the streak of the week and
// practise without talking.
export function Shortcuts({
  resume,
  streak,
  week,
  skillCount,
  onResume,
  onStreak,
  onLibrary
}: {
  // The step to go back to; null when there is no path.
  resume: { title: string; step: number; total: number } | null
  streak: number
  week: readonly WeekDay[]
  skillCount: number
  onResume: () => void
  onStreak: () => void
  onLibrary: () => void
}): React.JSX.Element {
  const letters = week.map((day) =>
    new Date(day.date).toLocaleDateString(currentLanguage(), { weekday: 'narrow' }).toUpperCase()
  )

  return (
    <div className="grid grid-cols-3 gap-3.5">
      <button type="button" onClick={onResume} className={`${CARD} anim-up`}>
        <ProgressRing share={resume ? (resume.step - 1) / resume.total : 0} />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.78rem] text-mut">{t('home.resume')}</span>
          <span className="mt-0.75 block truncate text-[0.97rem] font-semibold">
            {resume
              ? t('home.resume.step', {
                  title: resume.title,
                  step: resume.step,
                  total: resume.total
                })
              : t('home.resume.none')}
          </span>
        </span>
        <Arrow />
      </button>

      <button type="button" onClick={onStreak} className={`${CARD} anim-up [animation-delay:80ms]`}>
        <span
          aria-hidden="true"
          className="flex size-13 shrink-0 items-center justify-center rounded-[1.125rem] bg-grad text-on-brand shadow-[0_10px_26px_-10px_oklch(0.7_0.18_40/0.8)]"
        >
          <Icon name="flame" className="size-6" strokeWidth={1.7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.78rem] text-mut">{t('home.streak')}</span>
          <span className="mt-0.75 block truncate text-[0.97rem] font-semibold">
            {streak > 0
              ? t('dashboard.streak.days', { count: streak })
              : t('dashboard.streak.none')}
          </span>
        </span>
        <span className="flex gap-1" aria-hidden="true">
          {week.map((day, index) => (
            <span key={day.date} className="flex flex-col items-center gap-0.75">
              <span
                className={`h-5.5 w-2 rounded-md ${day.done ? 'bg-grad' : day.today ? 'bg-brand/40' : 'bg-line/10'}`}
              />
              <span className="text-[0.59rem] text-mut2">{letters[index]}</span>
            </span>
          ))}
        </span>
      </button>

      <button
        type="button"
        onClick={onLibrary}
        className={`${CARD} anim-up [animation-delay:160ms]`}
      >
        <span className="flex shrink-0 pl-1" aria-hidden="true">
          {CHANNEL_ORDER.map((channel) => (
            <span
              key={channel}
              className={`-ml-2 flex size-7.5 items-center justify-center rounded-full border-2 border-bg ${CHANNEL_LOOK[channel].fill} text-on-brand first:ml-0`}
            >
              <Icon name={CHANNEL_LOOK[channel].icon} className="size-3.75" strokeWidth={2} />
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1 pl-2.5">
          <span className="block text-[0.78rem] text-mut">{t('home.practiseFree')}</span>
          <span className="mt-0.75 block leading-tight text-[0.97rem] font-semibold">
            {t('home.library', { count: skillCount })}
          </span>
        </span>
        <Arrow />
      </button>
    </div>
  )
}
