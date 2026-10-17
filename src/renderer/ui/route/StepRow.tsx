import { currentLanguage, t } from '@renderer/i18n'
import type { PathStep } from '@shared/paths'
import type { StepState } from '@shared/pathProgress'
import type { SkillChannel } from '@shared/skill/skillChannels'
import { ChannelChips } from '../kit/ChannelChip'
import { Icon } from '../kit/Icon'
import { skillDisplayName } from '../skillName'

const formatDay = (timestamp: number): string =>
  new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium' }).format(timestamp)

// One step on the way: a node on the line, and the card that says what to do. Whether it is done,
// next or locked is said in words and shown by the shape of the node, never by colour alone.
export function StepRow({
  step,
  state,
  doneAt,
  channels,
  note,
  progress,
  actions,
  last
}: {
  step: PathStep
  state: StepState
  // When it was completed, if it is.
  doneAt: number | null
  channels: readonly SkillChannel[]
  // How the step stands, in a line: what is left to do, or why it is locked.
  note?: string
  // For a skill step that can still be done: how many sessions count out of how many are needed.
  progress?: { counted: number; required: number }
  actions?: React.ReactNode
  last: boolean
}): React.JSX.Element {
  const auxiliary = step.kind === 'auxiliary'
  const done = state === 'done'
  const current = state === 'current'
  const locked = state === 'locked'
  const percent = progress
    ? Math.min(100, Math.round((progress.counted / progress.required) * 100))
    : 0

  const kicker = done
    ? t('route.kicker.done', { n: step.position })
    : current
      ? t('route.kicker.current', { n: step.position })
      : t('path.step.number', { n: step.position })

  return (
    <li aria-current={current ? 'step' : undefined} className="flex gap-5">
      <div className="flex w-13 shrink-0 flex-col items-center">
        <span
          aria-hidden="true"
          style={current ? { animation: 'vy-node 2.2s ease-in-out infinite' } : undefined}
          className={`relative z-10 flex shrink-0 items-center justify-center rounded-full ${
            auxiliary ? 'mt-3.5 size-7.5' : 'mt-2.5 size-11'
          } ${
            done
              ? 'bg-brand text-on-brand'
              : current
                ? 'border-2 border-brand bg-bg text-good-text'
                : auxiliary
                  ? 'border border-dashed border-line/30 bg-bg text-mut'
                  : 'border border-line/10 bg-lock text-mut3'
          }`}
        >
          <Icon
            name={done ? 'check' : locked ? 'lock' : auxiliary ? 'book' : 'object'}
            className={auxiliary ? 'size-3' : 'size-4.5'}
            strokeWidth={1.8}
          />
        </span>
        {!last && <span className={`min-h-4.5 w-0.5 flex-1 ${done ? 'bg-brand' : 'bg-line/10'}`} />}
      </div>

      <div
        data-expand
        className={`mb-4 flex min-w-0 flex-1 flex-col gap-3 rounded-[1.375rem] ${
          auxiliary ? 'px-5 py-3.5' : 'p-5'
        } ${
          current
            ? 'border border-brand/45 bg-linear-to-b from-card to-card2'
            : auxiliary
              ? 'border border-dashed border-line/12'
              : 'border border-line/6 bg-card'
        } ${locked ? 'opacity-60' : ''}`}
      >
        <div className="flex items-start justify-between gap-3.5">
          <div>
            <p className="text-xs font-semibold tracking-[0.06em] text-mut uppercase">
              {auxiliary ? `${kicker} · ${t('path.step.auxiliary')}` : kicker}
            </p>
            <h3 className={`mt-1 font-semibold ${auxiliary ? 'text-[0.9375rem]' : 'text-lg'}`}>
              {step.title}
            </h3>
          </div>
          {!auxiliary && channels.length > 0 && <ChannelChips channels={channels} />}
        </div>

        {step.description !== '' && <p className="text-sm text-t4">{step.description}</p>}

        {step.kind === 'skill' && (
          <p className="text-[0.8125rem] text-mut">
            <span className="sr-only">{t('path.step.skill')}. </span>
            {t('path.step.skillName', { name: skillDisplayName(step.skillId) })} ·{' '}
            {t('path.step.goal', {
              count: step.criterionSessions,
              score: step.criterionScore
            })}
          </p>
        )}

        {done && doneAt !== null && (
          <p className="flex items-center gap-1.5 text-[0.8125rem] text-good-text">
            <span aria-hidden="true">✓</span> {t('path.step.done', { date: formatDay(doneAt) })}
          </p>
        )}

        {progress && (
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('dashboard.route.criterion')}
            className="h-1.5 overflow-hidden rounded-full bg-line/7"
          >
            <div
              className="h-full rounded-full bg-good transition-[width] duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        {note && <p className="text-[0.8125rem] text-mut">{note}</p>}

        {actions}
      </div>
    </li>
  )
}
