import { useState } from 'react'
import { t } from '@renderer/i18n'
import type { PathStep } from '@shared/paths'
import type { CurrentPath, StepProgress } from '@shared/pathProgress'
import { skillChannels } from '@shared/skill/skillChannels'
import { Button } from './kit/Button'
import { Card } from './kit/Card'
import { sortChannels } from './kit/channels'
import { useNavigation } from './navigation'
import { PathReviewPanel } from './PathReviewPanel'
import { StepRow } from './route/StepRow'
import { useSession } from './sessionStore'
import { findSkill } from './skillsStore'

// What is said of a skill step that is not done yet: how many sessions count, or that none has been
// tried. The text tells "not started" and "not there yet" apart.
function skillProgressText(progress: StepProgress): string | undefined {
  if (progress.counted === null || progress.required === null || progress.attempts === null) {
    return undefined
  }
  if (progress.attempts === 0) return t('path.step.notStarted')
  const counted = t('path.step.counted', { counted: progress.counted, required: progress.required })
  return `${counted} · ${t('path.step.attempts', { count: progress.attempts })}`
}

const channelsOf = (step: PathStep): ReturnType<typeof sortChannels> => {
  if (step.kind !== 'skill') return []
  const skill = findSkill(step.skillId)
  return skill ? sortChannels(skillChannels(skill)) : []
}

// The path being followed, as a way with its steps: what is done, what comes next, what is still
// locked and how to do each step, with the weekly review of the coach at the side.
export function ActivePath({
  current,
  onChanged,
  onNewPath
}: {
  current: CurrentPath
  onChanged: () => void
  onNewPath: () => void
}): React.JSX.Element {
  const { path, progress } = current
  const go = useNavigation((state) => state.go)
  const selectSkill = useSession((state) => state.selectSkill)
  const [failed, setFailed] = useState(false)

  const doneCount = progress.steps.filter((step) => step.state === 'done').length
  const percent = Math.round((doneCount / path.steps.length) * 100)
  const currentPosition = path.steps.find((step) => step.id === progress.currentStepId)?.position

  const practise = (skillId: string): void => {
    selectSkill(skillId)
    go('calibration')
  }

  const toggleDone = (stepId: number, done: boolean): void => {
    window.api.paths
      .setStepDone(stepId, done)
      .then((changed) => {
        setFailed(!changed)
        onChanged()
      })
      .catch(() => setFailed(true))
  }

  // A step can be undone while nothing after it is done.
  const canUndo = (step: PathStep): boolean =>
    !path.steps.some((later) => later.position > step.position && later.doneAt !== null)

  return (
    <section className="mx-auto flex h-full w-full max-w-295 flex-col gap-7 self-start overflow-y-auto px-8 pt-7 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1>
            <span className="block text-sm font-normal text-mut">{t('route.eyebrow')}</span>
            <span className="mt-2 block font-display text-[2.375rem] leading-tight font-semibold tracking-tight">
              {path.goal}
            </span>
          </h1>
          <p className="mt-2 text-[0.9375rem] text-mut">
            {t('route.summary', { count: path.steps.length })}
            {currentPosition !== undefined && ` · ${t('route.inProgress', { n: currentPosition })}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="min-w-65">
            <div className="flex justify-between text-[0.8125rem] text-t4">
              <span>{t('route.total')}</span>
              <span>{t('path.progress', { done: doneCount, total: path.steps.length })}</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('route.total')}
              className="mt-2 h-2 overflow-hidden rounded-full bg-line/7"
            >
              <div
                className="h-full rounded-full bg-good transition-[width] duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          <Button variant="secondary" onClick={onNewPath} title={t('path.new.note')}>
            {t('path.new')}
          </Button>
        </div>
      </header>

      {progress.completed && (
        <Card role="status" className="border-brand/40 p-5">
          <p className="text-xl font-semibold">
            <span aria-hidden="true">✓</span> {t('path.completed.title')}
          </p>
          <p className="mt-1 text-t4">{t('path.completed.body')}</p>
        </Card>
      )}

      {failed && (
        <p role="alert" className="text-bad-text">
          {t('path.updateFailed')}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ol className="flex flex-col">
          {path.steps.map((step, index) => {
            const stepProgress = progress.steps.find((item) => item.stepId === step.id)
            const state = stepProgress?.state ?? 'locked'
            const required = stepProgress?.required ?? null

            return (
              <StepRow
                key={step.id}
                step={step}
                state={state}
                last={index === path.steps.length - 1}
                doneAt={
                  state === 'done' ? (step.doneAt ?? stepProgress?.completedAt ?? null) : null
                }
                channels={channelsOf(step)}
                progress={
                  state !== 'locked' && required !== null && stepProgress
                    ? { counted: stepProgress.counted ?? 0, required }
                    : undefined
                }
                note={
                  state === 'locked'
                    ? t('path.step.locked')
                    : state === 'current' && stepProgress
                      ? skillProgressText(stepProgress)
                      : undefined
                }
                actions={
                  state === 'current' ? (
                    step.kind === 'skill' ? (
                      <div className="flex items-center gap-2.5">
                        <Button onClick={() => practise(step.skillId)}>
                          {t('path.step.practise')}
                        </Button>
                        <span className="text-[0.8125rem] text-mut">
                          {t('route.calibrationNote')}
                        </span>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        className="self-start"
                        onClick={() => toggleDone(step.id, true)}
                      >
                        {t('path.step.markDone')}
                      </Button>
                    )
                  ) : state === 'done' && step.kind === 'auxiliary' && canUndo(step) ? (
                    <Button
                      variant="ghost"
                      className="self-start"
                      onClick={() => toggleDone(step.id, false)}
                    >
                      {t('path.step.undo')}
                    </Button>
                  ) : undefined
                }
              />
            )
          })}
        </ol>

        <div className="flex flex-col gap-4.5 lg:sticky lg:top-0">
          {!progress.completed && <PathReviewPanel path={path} onApplied={onChanged} />}
          <Card className="flex flex-col gap-2.5 p-5.5">
            <p className="text-[0.8125rem] text-mut">{t('route.how.title')}</p>
            <p className="text-sm leading-normal text-t4">{t('route.how.body')}</p>
          </Card>
        </div>
      </div>
    </section>
  )
}
