import { useState } from 'react'
import { t } from '@renderer/i18n'
import type { CoachError } from '@shared/coach'
import type { LearningPath } from '@shared/paths'
import type { Adjustment, PathReview } from '@shared/pathReview'
import { CoachErrorNotice } from './CoachErrorNotice'
import { Button } from './kit/Button'
import { Card } from './kit/Card'
import { CoachAvatar } from './kit/CoachAvatar'
import { openSettings } from './settingsTabStore'
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

// What a change to the goal of a step replaces, so that the person sees the before and the after.
function beforeOf(adjustment: Adjustment, path: LearningPath): string | null {
  if (adjustment.type !== 'change-criteria') return null
  const step = path.steps.find((candidate) => candidate.id === adjustment.stepId)
  if (step?.kind !== 'skill') return null
  return t('path.step.goal', { count: step.criterionSessions, score: step.criterionScore })
}

const afterOf = (adjustment: Adjustment): string | null =>
  adjustment.type === 'change-criteria'
    ? t('path.step.goal', {
        count: adjustment.criterionSessions,
        score: adjustment.criterionScore
      })
    : null

// The review of the week: the coach says how it went and may propose changes to the path, and the
// person chooses which ones to apply. What is not chosen is left as it was.
export function PathReviewPanel({
  path,
  onApplied
}: {
  path: LearningPath
  onApplied: () => void
}): React.JSX.Element {
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
    <Card className="flex flex-col gap-4 border-line/7 p-6">
      <div className="flex items-center gap-3">
        <CoachAvatar />
        <h2 className="text-[1.0625rem] font-semibold">{t('path.review.title')}</h2>
      </div>

      {!aiEnabled ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-t4">{t('path.review.off')}</p>
          <Button variant="secondary" onClick={() => openSettings('ai')}>
            {t('coach.openSettings')}
          </Button>
        </div>
      ) : (
        <>
          {(state.status === 'idle' || state.status === 'pending' || state.status === 'failed') && (
            <div className="flex flex-col items-start gap-3">
              <Button onClick={ask} disabled={state.status === 'pending'}>
                {t('path.review.ask')}
              </Button>
              <p className="text-[0.8125rem] text-mut">{t('path.review.privacy')}</p>
            </div>
          )}

          {applied && (
            <p role="status" className="anim-up text-sm text-t4">
              {t('path.review.applied')}
            </p>
          )}
          {state.status === 'pending' && (
            <p role="status" className="text-sm text-mut">
              {t('path.review.pending')}
            </p>
          )}
          {state.status === 'failed' && <CoachErrorNotice error={state.error} onRetry={ask} />}

          {state.status === 'review' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-normal text-t4 text-pretty">{state.review.summary}</p>

              {state.review.adjustments.length === 0 ? (
                <p className="text-sm">{t('path.review.none')}</p>
              ) : (
                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-1 text-sm font-semibold">
                    {t('path.review.proposals')}
                  </legend>
                  {state.review.adjustments.map((adjustment, index) => {
                    const before = beforeOf(adjustment, path)
                    const after = afterOf(adjustment)
                    return (
                      <label
                        key={index}
                        className="flex items-start gap-3 rounded-2xl bg-sunk p-3.5"
                      >
                        <input
                          type="checkbox"
                          checked={state.chosen.has(index)}
                          disabled={state.applying}
                          onChange={() => toggle(index)}
                          className="mt-1 size-5 accent-brand"
                        />
                        <span className="flex flex-col gap-2">
                          <span className="text-sm">{describe(adjustment, path)}</span>
                          {before && after && (
                            <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[0.8125rem]">
                              <span className="rounded-xl bg-line/5 px-2.5 py-1.5 text-mut line-through">
                                {before}
                              </span>
                              <span aria-hidden="true" className="text-mut">
                                →
                              </span>
                              <span className="rounded-xl border border-brand/30 bg-brand/10 px-2.5 py-1.5">
                                {after}
                              </span>
                            </span>
                          )}
                          <span className="text-[0.8125rem] text-mut">
                            {t('path.adjust.reason', { reason: adjustment.reason })}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </fieldset>
              )}

              {state.stale && (
                <p role="alert" className="text-sm text-bad-text">
                  {t('path.review.stale')}
                </p>
              )}

              <div className="flex flex-wrap gap-2.5">
                {state.review.adjustments.length > 0 && (
                  <Button onClick={apply} disabled={state.applying || state.chosen.size === 0}>
                    {t('path.review.apply')}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => setState({ status: 'idle' })}
                  disabled={state.applying}
                >
                  {state.review.adjustments.length > 0
                    ? t('path.review.dismiss')
                    : t('path.review.close')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
