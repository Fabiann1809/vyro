import { useState } from 'react'
import { t } from '@renderer/i18n'
import type { PathStep } from '@shared/paths'
import type { CurrentPath, StepProgress } from '@shared/pathProgress'
import { useNavigation } from './navigation'
import { PathStepCard } from './PathStepCard'
import { useSession } from './sessionStore'

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

// The path being followed: what is done, what comes next, what is still locked and how to do each step.
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
    <section className="flex w-full max-w-3xl flex-col gap-4 self-start p-8">
      <header className="flex flex-wrap items-baseline gap-4">
        <h1 className="text-3xl font-semibold">{t('screen.path.title')}</h1>
        <button
          type="button"
          onClick={onNewPath}
          className="ml-auto rounded-md bg-slate-200 px-3 py-1.5 text-sm dark:bg-slate-800"
        >
          {t('path.new')}
        </button>
      </header>

      <div>
        <p className="text-xl">{path.goal}</p>
        <p className="text-slate-600 dark:text-slate-400">
          {t('path.progress', { done: doneCount, total: path.steps.length })}
        </p>
      </div>

      {progress.completed && (
        <div
          role="status"
          className="rounded-lg border border-emerald-700 p-4 dark:border-emerald-500"
        >
          <p className="text-xl font-semibold">
            <span aria-hidden="true">✓</span> {t('path.completed.title')}
          </p>
          <p>{t('path.completed.body')}</p>
        </div>
      )}

      {failed && <p role="alert">{t('path.updateFailed')}</p>}

      <ol className="flex flex-col gap-3">
        {path.steps.map((step) => {
          const stepProgress = progress.steps.find((item) => item.stepId === step.id)
          const state = stepProgress?.state ?? 'locked'

          return (
            <PathStepCard
              key={step.id}
              step={step}
              number={step.position}
              doneAt={state === 'done' ? (step.doneAt ?? stepProgress?.completedAt ?? null) : null}
              isNext={state === 'current'}
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
                    <button
                      type="button"
                      onClick={() => practise(step.skillId)}
                      className="w-fit rounded-md bg-emerald-700 px-4 py-2 text-white"
                    >
                      {t('path.step.practise')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleDone(step.id, true)}
                      className="w-fit rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
                    >
                      {t('path.step.markDone')}
                    </button>
                  )
                ) : state === 'done' && step.kind === 'auxiliary' && canUndo(step) ? (
                  <button
                    type="button"
                    onClick={() => toggleDone(step.id, false)}
                    className="w-fit rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
                  >
                    {t('path.step.undo')}
                  </button>
                ) : undefined
              }
            />
          )
        })}
      </ol>
    </section>
  )
}
