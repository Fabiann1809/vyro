import { useState } from 'react'
import { t } from '@renderer/i18n'
import type { CoachError } from '@shared/coach'
import type { LearningPath } from '@shared/paths'
import type { Adjustment, PathReview } from '@shared/pathReview'
import { CoachErrorNotice } from './CoachErrorNotice'
import { useNavigation } from './navigation'
import { plannerSkills } from './plannerSkills'
import { useSettings } from './settingsStore'

type State =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'failed'; error: CoachError }
  | {
      status: 'review'
      review: PathReview
      chosen: ReadonlySet<number>
      applying: boolean
      stale: boolean
    }

const titleOf = (path: LearningPath, stepId: number): string =>
  path.steps.find((step) => step.id === stepId)?.title ?? ''

// What one change says, in words.
function describe(adjustment: Adjustment, path: LearningPath): string {
  switch (adjustment.type) {
    case 'change-criteria':
      return t('path.adjust.change', {
        title: titleOf(path, adjustment.stepId),
        count: adjustment.criterionSessions,
        score: adjustment.criterionScore
      })
    case 'add-step':
      return t('path.adjust.add', {
        after: titleOf(path, adjustment.afterStepId),
        title: adjustment.step.title
      })
    case 'remove-step':
      return t('path.adjust.remove', { title: titleOf(path, adjustment.stepId) })
  }
}

// The review of the week: the coach says how it went and may propose changes to the path, and the
// person chooses which ones to apply. What is not chosen is left as it was.
export function PathReviewPanel({
  path,
  onApplied
}: {
  path: LearningPath
  onApplied: () => void
}): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const aiEnabled = useSettings((state) => state.aiEnabled)
  const language = useSettings((state) => state.language)
  const [state, setState] = useState<State>({ status: 'idle' })
  const [applied, setApplied] = useState(false)

  const ask = (): void => {
    setApplied(false)
    setState({ status: 'pending' })
    window.api.coach
      .reviewPath({ language, skills: plannerSkills() })
      .then((result) =>
        setState(
          result.ok
            ? {
                status: 'review',
                review: result.value,
                chosen: new Set(result.value.adjustments.map((_, index) => index)),
                applying: false,
                stale: false
              }
            : { status: 'failed', error: result.error }
        )
      )
      .catch(() => setState({ status: 'failed', error: { kind: 'unknown' } }))
  }

  const toggle = (index: number): void => {
    setState((previous) => {
      if (previous.status !== 'review') return previous
      const chosen = new Set(previous.chosen)
      if (!chosen.delete(index)) chosen.add(index)
      return { ...previous, chosen }
    })
  }

  const apply = (): void => {
    if (state.status !== 'review') return
    const { review, chosen } = state
    const selected = review.adjustments.filter((_, index) => chosen.has(index))
    setState({ ...state, applying: true, stale: false })
    window.api.paths
      .applyAdjustments({
        pathId: review.pathId,
        adjustments: selected,
        skillIds: plannerSkills().map((skill) => skill.id)
      })
      .then((done) => {
        if (done) {
          setApplied(true)
          setState({ status: 'idle' })
          onApplied()
        } else {
          setState({ ...state, applying: false, stale: true })
        }
      })
      .catch(() => setState({ ...state, applying: false, stale: true }))
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-300 pt-4 dark:border-slate-700">
      <h2 className="text-xl font-semibold">{t('path.review.title')}</h2>

      {!aiEnabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-slate-600 dark:text-slate-400">{t('path.review.off')}</p>
          <button
            type="button"
            onClick={() => go('settings')}
            className="rounded-md bg-slate-200 px-3 py-1.5 dark:bg-slate-800"
          >
            {t('coach.openSettings')}
          </button>
        </div>
      ) : (
        <>
          {(state.status === 'idle' || state.status === 'pending' || state.status === 'failed') && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={ask}
                disabled={state.status === 'pending'}
                className="rounded-md bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
              >
                {t('path.review.ask')}
              </button>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('path.review.privacy')}
              </p>
            </div>
          )}

          {applied && <p role="status">{t('path.review.applied')}</p>}
          {state.status === 'pending' && (
            <p role="status" className="text-slate-600 dark:text-slate-400">
              {t('path.review.pending')}
            </p>
          )}
          {state.status === 'failed' && <CoachErrorNotice error={state.error} onRetry={ask} />}

          {state.status === 'review' && (
            <div className="flex flex-col gap-3">
              <p>{state.review.summary}</p>

              {state.review.adjustments.length === 0 ? (
                <p>{t('path.review.none')}</p>
              ) : (
                <fieldset className="flex flex-col gap-3">
                  <legend className="font-semibold">{t('path.review.proposals')}</legend>
                  {state.review.adjustments.map((adjustment, index) => (
                    <label key={index} className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={state.chosen.has(index)}
                        disabled={state.applying}
                        onChange={() => toggle(index)}
                        className="mt-1 size-5"
                      />
                      <span className="flex flex-col">
                        <span>{describe(adjustment, path)}</span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {t('path.adjust.reason', { reason: adjustment.reason })}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}

              {state.stale && <p role="alert">{t('path.review.stale')}</p>}

              <div className="flex flex-wrap gap-3">
                {state.review.adjustments.length > 0 && (
                  <button
                    type="button"
                    onClick={apply}
                    disabled={state.applying || state.chosen.size === 0}
                    className="rounded-md bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
                  >
                    {t('path.review.apply')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setState({ status: 'idle' })}
                  disabled={state.applying}
                  className="rounded-md bg-slate-200 px-4 py-2 disabled:opacity-50 dark:bg-slate-800"
                >
                  {state.review.adjustments.length > 0
                    ? t('path.review.dismiss')
                    : t('path.review.close')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
