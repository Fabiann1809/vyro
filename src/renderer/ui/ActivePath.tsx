import { useState } from 'react'
import { t } from '@renderer/i18n'
import type { LearningPath } from '@shared/paths'
import { useNavigation } from './navigation'
import { PathStepCard } from './PathStepCard'
import { useSession } from './sessionStore'

// The path being followed: what is done, what comes next, and how to do each step.
export function ActivePath({
  path,
  onChanged,
  onNewPath
}: {
  path: LearningPath
  onChanged: () => void
  onNewPath: () => void
}): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const selectSkill = useSession((state) => state.selectSkill)
  const [failed, setFailed] = useState(false)

  const doneCount = path.steps.filter((step) => step.doneAt !== null).length
  const nextStep = path.steps.find((step) => step.doneAt === null)

  const practise = (skillId: string): void => {
    selectSkill(skillId)
    go('calibration')
  }

  const toggleDone = (stepId: number, done: boolean): void => {
    window.api.paths
      .setStepDone(stepId, done)
      .then(() => {
        setFailed(false)
        onChanged()
      })
      .catch(() => setFailed(true))
  }

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

      {failed && <p role="alert">{t('path.updateFailed')}</p>}

      <ol className="flex flex-col gap-3">
        {path.steps.map((step) => (
          <PathStepCard
            key={step.id}
            step={step}
            number={step.position}
            doneAt={step.doneAt}
            isNext={step.id === nextStep?.id}
            actions={
              step.kind === 'skill' ? (
                step.doneAt === null && (
                  <button
                    type="button"
                    onClick={() => practise(step.skillId)}
                    className="w-fit rounded-md bg-emerald-700 px-4 py-2 text-white"
                  >
                    {t('path.step.practise')}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => toggleDone(step.id, step.doneAt === null)}
                  className="w-fit rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
                >
                  {step.doneAt === null ? t('path.step.markDone') : t('path.step.undo')}
                </button>
              )
            }
          />
        ))}
      </ol>
    </section>
  )
}
