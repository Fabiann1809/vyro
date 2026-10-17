import { currentLanguage, t } from '@renderer/i18n'
import type { SessionRow } from '@shared/sessions'
import { skillDisplayName } from './skillName'

const formatDate = (timestamp: number): string =>
  new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium', timeStyle: 'short' }).format(
    timestamp
  )

export function SessionList({ sessions }: { sessions: readonly SessionRow[] }): React.JSX.Element {
  return (
    <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
      {sessions.map((session) => (
        <li key={session.id} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-3">
          <span className="font-medium">{skillDisplayName(session.skillId)}</span>
          <span className="text-slate-600 dark:text-slate-400">
            {formatDate(session.startedAt)}
          </span>
          <span>{t('summary.total', { count: session.repCount })}</span>
          <span>{t('summary.good', { count: session.goodCount })}</span>
          <span className="ml-auto font-semibold tabular-nums">
            {session.score === null ? '—' : t('history.score', { score: session.score })}
          </span>
        </li>
      ))}
    </ul>
  )
}
