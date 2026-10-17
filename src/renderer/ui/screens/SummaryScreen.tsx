import { buildSessionDigest, summarizeSession } from '@renderer/engine/sessionSummary'
import type { RepQuality } from '@renderer/engine/repEvaluator'
import { localize, t, type MessageKey } from '@renderer/i18n'
import { bundledSkills } from '@renderer/skills'
import { CoachSummary } from '../CoachSummary'
import { useNavigation } from '../navigation'
import { useSession } from '../sessionStore'

// Never colour alone: each quality has its own symbol and its own words.
const QUALITY: Record<RepQuality, { symbol: string; label: MessageKey }> = {
  good: { symbol: '✓', label: 'training.quality.good' },
  'needs-work': { symbol: '!', label: 'training.quality.needsWork' },
  bad: { symbol: '✗', label: 'training.quality.bad' },
  unknown: { symbol: '?', label: 'summary.quality.unknown' }
}

// A session this short says little about the technique.
const SHORT_SESSION_REPS = 5

const clock = (ms: number): string => {
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function SummaryScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const finished = useSession((state) => state.finished)
  const saveStatus = useSession((state) => state.saveStatus)
  const skill = bundledSkills.skills.find((candidate) => candidate.id === finished?.skillId)

  if (!finished || !skill) {
    return (
      <section className="flex flex-col items-center gap-4 p-8">
        <p>{t('summary.none')}</p>
        <button
          type="button"
          onClick={() => go('home')}
          className="rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
        >
          {t('summary.home')}
        </button>
      </section>
    )
  }

  const summary = summarizeSession(finished.results)
  const topError = summary.errors[0]
  const digest = buildSessionDigest(
    finished.skillId,
    finished.startedAt,
    finished.durationMs,
    finished.results
  )

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold">
          {t('screen.summary.title')} · {localize(skill.name)}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {t('summary.duration', { time: clock(finished.durationMs) })}
        </p>
      </div>

      {(saveStatus === 'saved' || saveStatus === 'failed') && (
        <p role="status">{t(saveStatus === 'saved' ? 'summary.saved' : 'summary.saveFailed')}</p>
      )}

      {summary.score === null ? (
        <p className="text-xl">{t('summary.noReps')}</p>
      ) : (
        <>
          <div className="flex items-end gap-8">
            <p className="text-7xl font-bold tabular-nums">
              {summary.score}
              <span className="text-2xl font-normal"> / 100</span>
            </p>
            <ul className="text-lg">
              <li>{t('summary.total', { count: summary.judged })}</li>
              <li>{t('summary.good', { count: summary.good })}</li>
              <li>{t('summary.needsWork', { count: summary.needsWork })}</li>
              <li>{t('summary.bad', { count: summary.bad })}</li>
            </ul>
          </div>

          {summary.judged < SHORT_SESSION_REPS && (
            <p className="text-slate-600 dark:text-slate-400">{t('summary.short')}</p>
          )}

          <ol aria-label={t('summary.sequence')} className="flex flex-wrap gap-2">
            {summary.qualities.map((quality, index) => (
              <li
                key={index}
                className="flex size-10 items-center justify-center rounded-md bg-slate-200 text-lg dark:bg-slate-800"
              >
                <span aria-hidden="true">{QUALITY[quality].symbol}</span>
                <span className="sr-only">
                  {index + 1}: {t(QUALITY[quality].label)}
                </span>
              </li>
            ))}
          </ol>

          <div>
            <h2 className="text-xl font-semibold">{t('summary.errors')}</h2>
            {topError ? (
              <>
                <ul className="mt-2 list-inside list-disc">
                  {summary.errors.map((error) => (
                    <li key={error.ruleId}>
                      {localize(error.message)} · {t('summary.times', { count: error.count })}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-lg">
                  {t('summary.tip')} {localize(topError.message)}
                </p>
              </>
            ) : (
              <p className="mt-2">{t('summary.noErrors')}</p>
            )}
          </div>
        </>
      )}

      {digest && <CoachSummary key={digest.startedAt} digest={digest} />}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => go('calibration')}
          className="rounded-md bg-emerald-700 px-4 py-2 text-white"
        >
          {t('summary.again')}
        </button>
        <button
          type="button"
          onClick={() => go('progress')}
          className="rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
        >
          {t('summary.progress')}
        </button>
        <button
          type="button"
          onClick={() => go('home')}
          className="rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
        >
          {t('summary.home')}
        </button>
      </div>
    </section>
  )
}
