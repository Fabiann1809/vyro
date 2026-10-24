import { t } from '@renderer/i18n'
import type { CurrentPath } from '@shared/pathProgress'
import { ProgressRing } from '../charts/ProgressRing'
import { cardOf } from '../expandTransition'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'
import { illustrationOf } from '../skillIllustration'

// What to do next: the path being followed, with the picture of the skill inside a ring that shows how
// far the path has got, and the one button that goes on with it. Without a path it invites to ask
// the coach for one.
export function ActiveRouteCard({
  current,
  onContinue,
  onOpen,
  onAsk,
  onLibrary
}: {
  current: CurrentPath | null
  // Gets the card, which is what grows into the practice.
  onContinue: (card: Element | null) => void
  onOpen: () => void
  onAsk: () => void
  onLibrary: () => void
}): React.JSX.Element {
  if (!current) {
    return (
      <Card
        data-expand
        className="flex flex-col items-start gap-3 bg-[radial-gradient(circle_at_50%_0%,oklch(0.7_0.17_45/0.22),transparent_60%)] p-6 lg:col-span-4"
      >
        <p className="text-[0.8125rem] text-mut">{t('dashboard.next.label')}</p>
        <h2 className="text-[1.3125rem] font-bold">{t('dashboard.route.none')}</h2>
        <div className="mt-auto flex flex-wrap gap-2.5">
          <Button onClick={onAsk}>{t('dashboard.route.ask')}</Button>
          <Button variant="secondary" onClick={onLibrary}>
            {t('dashboard.next.library')}
          </Button>
        </div>
      </Card>
    )
  }

  const { path, progress } = current
  const steps = [...path.steps].sort((a, b) => a.position - b.position)
  const states = steps.map((step) => progress.steps.find((item) => item.stepId === step.id))
  const currentIndex = Math.max(
    0,
    states.findIndex((state) => state?.state === 'current')
  )
  const step = steps[currentIndex]
  const stepProgress = states[currentIndex]
  const required = stepProgress?.required ?? null
  const counted = stepProgress?.counted ?? 0
  const percent = required ? Math.min(100, Math.round((counted / required) * 100)) : 0
  const doneCount = states.filter((state) => state?.state === 'done').length
  const picture = step?.kind === 'skill' ? illustrationOf(step.skillId) : null

  return (
    <Card
      data-expand
      className="flex flex-col items-center gap-3.5 bg-[radial-gradient(circle_at_50%_0%,oklch(0.7_0.17_45/0.28),transparent_60%)] p-6 text-center lg:col-span-4"
    >
      <p className="text-[0.8125rem] text-mut">{t('dashboard.next.label')}</p>
      <div className="relative size-44">
        <ProgressRing share={doneCount / steps.length} size="size-44" />
        <span
          aria-hidden="true"
          className="absolute inset-4 overflow-hidden rounded-full border border-[rgba(255,214,180,0.25)] bg-[radial-gradient(circle_at_50%_30%,oklch(0.7_0.15_30/0.35),transparent_70%)] shadow-[inset_0_0_30px_oklch(0.7_0.17_45/0.3)]"
        >
          {picture && <img src={picture} alt="" className="size-full object-cover" />}
        </span>
        <span className="absolute -bottom-1.5 left-1/2 flex h-7 -translate-x-1/2 items-center rounded-full bg-t1 px-3 text-[0.78rem] font-bold whitespace-nowrap text-inv">
          {t('dashboard.next.stepOf', { step: currentIndex + 1, total: steps.length })}
        </span>
      </div>
      <div>
        <h2 className="mt-1.5 font-display text-2xl font-bold">
          {progress.completed ? t('path.completed.title') : (step?.title ?? path.goal)}
        </h2>
        <p className="mt-1 text-[0.84rem] text-mut">{path.goal}</p>
      </div>

      {required !== null && !progress.completed && (
        <div className="w-full">
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[0.8125rem] text-t4">
            <span>{t('dashboard.route.criterion')}</span>
            <span>{t('path.step.counted', { counted, required })}</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('dashboard.route.criterion')}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/8"
          >
            <div
              className="h-full rounded-full bg-grad transition-[width] duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-auto flex w-full flex-col gap-2">
        {!progress.completed && (
          <Button size="lg" className="w-full" onClick={(e) => onContinue(cardOf(e.currentTarget))}>
            {t('dashboard.next.continue')} <span aria-hidden="true">→</span>
          </Button>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="text-sm font-semibold text-accent hover:underline"
        >
          {t('dashboard.route.open')} →
        </button>
      </div>
    </Card>
  )
}
