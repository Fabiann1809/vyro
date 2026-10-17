import { currentLanguage, t } from '@renderer/i18n'
import type { PathStepToSave } from '@shared/paths'
import { skillDisplayName } from './skillName'

const formatDay = (timestamp: number): string =>
  new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium' }).format(timestamp)

// One step of a path. The kind of step is said in words and with a symbol, never by colour alone.
export function PathStepCard({
  step,
  number,
  doneAt = null,
  isNext = false,
  note,
  actions
}: {
  step: PathStepToSave
  number: number
  doneAt?: number | null
  // The step to do now.
  isNext?: boolean
  // How the step stands, in a line: what is left to do, or why it is locked.
  note?: string
  actions?: React.ReactNode
}): React.JSX.Element {
  return (
    <li
      aria-current={isNext ? 'step' : undefined}
      className={`flex flex-col gap-2 rounded-lg border p-4 ${
        isNext
          ? 'border-emerald-700 dark:border-emerald-500'
          : 'border-slate-300 dark:border-slate-700'
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold">{t('path.step.number', { n: number })}</span>
        <span>
          <span aria-hidden="true">{step.kind === 'skill' ? '◎' : '○'}</span>{' '}
          {step.kind === 'skill' ? t('path.step.skill') : t('path.step.auxiliary')}
        </span>
        {doneAt !== null && (
          <span>
            <span aria-hidden="true">✓</span> {t('path.step.done', { date: formatDay(doneAt) })}
          </span>
        )}
        {isNext && doneAt === null && (
          <span className="font-semibold">
            <span aria-hidden="true">→</span> {t('path.step.next')}
          </span>
        )}
      </div>

      <h3 className="text-lg font-semibold">{step.title}</h3>
      {step.description !== '' && <p>{step.description}</p>}

      {step.kind === 'skill' && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('path.step.skillName', { name: skillDisplayName(step.skillId) })} ·{' '}
          {t('path.step.goal', { count: step.criterionSessions, score: step.criterionScore })}
        </p>
      )}

      {note && <p className="text-sm text-slate-600 dark:text-slate-400">{note}</p>}

      {actions}
    </li>
  )
}
