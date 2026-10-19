import { t } from '@renderer/i18n'
import type { CurrentPath } from '@shared/pathProgress'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'
import { Icon } from '../kit/Icon'

// The path being followed, small: where it is, and how close the current step is to done.
export function ActiveRouteCard({
  current,
  onOpen,
  onAsk
}: {
  current: CurrentPath | null
  onOpen: () => void
  onAsk: () => void
}): React.JSX.Element {
  if (!current) {
    return (
      <Card className="flex flex-col items-start gap-3 p-6">
        <p className="text-[0.8125rem] text-mut">{t('dashboard.route.label')}</p>
        <h2 className="text-[1.3125rem] font-semibold">{t('dashboard.route.none')}</h2>
        <Button variant="secondary" className="mt-auto" onClick={onAsk}>
          {t('dashboard.route.ask')}
        </Button>
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

  return (
    <Card className="flex flex-col gap-4.5 p-6">
      <div>
        <p className="text-[0.8125rem] text-mut">{t('dashboard.route.label')}</p>
        <h2 className="mt-1 text-[1.3125rem] font-semibold">{path.goal}</h2>
        <p className="mt-1 text-sm text-mut">
          {progress.completed
            ? t('path.completed.title')
            : t('dashboard.route.at', {
                step: currentIndex + 1,
                total: steps.length,
                title: step?.title ?? ''
              })}
        </p>
      </div>

      {/* The steps and the criterion sit in the middle of what is left, so a tall card has no hole. */}
      <div className="flex flex-1 flex-col justify-center gap-4.5">
        <ol aria-hidden="true" className="flex items-center py-2">
          {states.map((state, index) => {
            const isLast = index === states.length - 1
            const done = state?.state === 'done'
            const now = state?.state === 'current'
            return (
              <li key={index} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
                <span
                  className={`flex size-8.5 shrink-0 items-center justify-center rounded-full ${
                    done
                      ? 'bg-brand text-on-brand'
                      : now
                        ? 'border-2 border-brand text-brand'
                        : 'border border-line/10 bg-lock text-mut3'
                  }`}
                  style={now ? { animation: 'vy-node 2.2s ease-in-out infinite' } : undefined}
                >
                  <Icon
                    name={done ? 'check' : now ? 'book' : 'lock'}
                    className="size-3.75"
                    strokeWidth={1.8}
                  />
                </span>
                {!isLast && <span className={`h-0.5 flex-1 ${done ? 'bg-brand' : 'bg-line/10'}`} />}
              </li>
            )
          })}
        </ol>

        {required !== null && !progress.completed && (
          <div>
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
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/7"
            >
              <div
                className="h-full rounded-full bg-good transition-[width] duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="self-start text-sm font-semibold text-accent hover:underline"
      >
        {t('dashboard.route.open')} →
      </button>
    </Card>
  )
}
