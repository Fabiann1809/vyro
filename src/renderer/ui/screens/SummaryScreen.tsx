import { useEffect, useState } from 'react'
import {
  buildSessionDigest,
  sessionNumbers,
  summarizeSession,
  type SessionNumbers
} from '@renderer/engine/sessionSummary'
import { localize, t } from '@renderer/i18n'
import { ruleChannel } from '@shared/skill/ruleChannels'
import type { SkillChannel } from '@shared/skill/skillChannels'
import { RepNecklace } from '../charts/RepNecklace'
import { Ring } from '../charts/Ring'
import { toChartQuality } from '../dashboardData'
import { CoachSummary } from '../CoachSummary'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'
import { ChannelOrb } from '../kit/ChannelOrb'
import { Icon } from '../kit/Icon'
import { useNavigation } from '../navigation'
import { useSession } from '../sessionStore'
import { useSkills } from '../skillsStore'
import { compareWithBefore, stepOutcome, type Comparison, type StepOutcome } from '../summaryData'
import { measureRows, UNIT_SEQUENCE, UNIT_TOTAL, unjudgedCount } from '../summaryProgress'

// A session this short says little about the technique.
const SHORT_SESSION_REPS = 5

const clock = (ms: number): string => {
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// The corrections of the session, most frequent first: each with the channel it is about and a few
// pips that fill up as it happened more.
function Corrections({
  rows,
  most
}: {
  rows: ReadonlyArray<{ key: string; message: string; count: number; channel: SkillChannel }>
  most: number
}): React.JSX.Element {
  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((row) => {
        const filled = Math.max(1, Math.round((row.count / most) * 4))
        return (
          <li key={row.key} className="flex items-center gap-3">
            <ChannelOrb channel={row.channel} size="size-10" />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2 text-sm font-semibold">
                <span>{row.message}</span>
                <span className="shrink-0 whitespace-nowrap text-mut">
                  {t('summary.times', { count: row.count })}
                </span>
              </div>
              <div aria-hidden="true" className="mt-1.5 flex gap-0.75">
                {[0, 1, 2, 3].map((pip) => (
                  <span
                    key={pip}
                    className={`h-1.5 flex-1 rounded-sm ${pip < filled ? 'bg-grad' : 'bg-line/12'}`}
                  />
                ))}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// How the attempts went, in three boxes: the size of the dot tells good, so-so and bad apart as
// well as its colour.
function Breakdown({
  good,
  needsWork,
  bad
}: {
  good: number
  needsWork: number
  bad: number
}): React.JSX.Element {
  const boxes = [
    { count: good, label: t('summary.good', { count: good }), dot: 'bg-good size-4' },
    {
      count: needsWork,
      label: t('summary.needsWork', { count: needsWork }),
      dot: 'bg-warn size-3'
    },
    { count: bad, label: t('summary.bad', { count: bad }), dot: 'bg-bad size-2.5' }
  ]
  return (
    <ul className="grid grid-cols-3 gap-2.5">
      {boxes.map((box) => (
        <li key={box.label} className="flex items-center gap-3 rounded-[1.375rem] bg-sunk p-3.5">
          <span aria-hidden="true" className={`shrink-0 rounded-full ${box.dot}`} />
          <span>
            <span className="block font-display text-[1.625rem] leading-none font-bold">
              {box.count}
            </span>
            <span className="text-[0.78rem] text-mut">{box.label}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

interface Context {
  // The session before this one, to set the measures of the skill against it.
  previous: SessionNumbers | null
  comparison: Comparison
  step: StepOutcome | null
}

export function SummaryScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const finished = useSession((state) => state.finished)
  const selectSkill = useSession((state) => state.selectSkill)
  const saveStatus = useSession((state) => state.saveStatus)
  const skills = useSkills((state) => state.skills)
  const skill = skills.find((candidate) => candidate.id === finished?.skillId)
  const [context, setContext] = useState<Context | null>(null)

  const summary = finished ? summarizeSession(finished.results) : null
  const score = summary?.score ?? null

  // Once the session is kept, how it compares with the earlier ones and what it did for the path.
  useEffect(() => {
    if (saveStatus !== 'saved' || !finished || score === null) return
    let cancelled = false
    Promise.all([
      window.api.sessions.list({ skillId: finished.skillId }),
      window.api.paths.getCurrent().catch(() => null)
    ])
      .then(async ([sessions, path]) => {
        const last = sessions
          .filter((session) => session.startedAt < finished.startedAt)
          .sort((a, b) => b.startedAt - a.startedAt)[0]
        const detail = last ? await window.api.sessions.get(last.id) : null
        if (cancelled) return
        setContext({
          previous: detail ? sessionNumbers(detail.reps) : null,
          comparison: compareWithBefore(sessions, finished.startedAt, score),
          step: stepOutcome(path, finished.skillId, finished.startedAt, score)
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [saveStatus, finished, score])

  if (!finished || !skill || !summary) {
    return (
      <section className="flex flex-col items-center gap-4 p-8">
        <p>{t('summary.none')}</p>
        <Button variant="secondary" onClick={() => go('home')}>
          {t('summary.home')}
        </Button>
      </section>
    )
  }

  const topError = summary.errors[0]
  const digest = buildSessionDigest(
    finished.skillId,
    finished.startedAt,
    finished.durationMs,
    finished.results,
    skill.progress
  )
  const qualities = summary.qualities.flatMap((quality) => {
    const chart = toChartQuality(quality)
    return chart ? [chart] : []
  })
  const name = localize(skill.name)
  const { comparison, step, previous } = context ?? { comparison: null, step: null, previous: null }
  const unit = skill.progress?.unit ?? 'reps'
  const rows = measureRows(summary, previous, skill.progress?.measures ?? [])
  const unjudged = unjudgedCount(summary.qualities)

  const goNext = (): void => {
    if (step?.kind === 'completed' && step.next?.kind === 'skill') {
      selectSkill(step.next.skillId)
      go('calibration')
    } else {
      go('path')
    }
  }

  return (
    <section className="anim-fade mx-auto flex h-full w-full max-w-335 flex-col gap-4 self-start overflow-y-auto px-4.5 pt-3.5 pb-12">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-5 px-1 pt-1.5">
        <div>
          <h1>
            <span className="block text-[0.8125rem] font-bold tracking-[0.14em] text-accent uppercase">
              {t('screen.summary.title')} ·{' '}
              {t('summary.duration', { time: clock(finished.durationMs) })}
            </span>
            <span className="mt-2 block font-display text-[2.375rem] leading-tight font-bold tracking-[-0.03em]">
              {name}
            </span>
          </h1>
          {(saveStatus === 'saved' || saveStatus === 'failed') && (
            <p role="status" className="mt-2 text-sm text-mut">
              {t(saveStatus === 'saved' ? 'summary.saved' : 'summary.saveFailed')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5">
          {step?.kind === 'completed' && (
            <Button size="lg" onClick={goNext}>
              {t('summary.nextStep')}
            </Button>
          )}
          <Button
            size="lg"
            variant={step?.kind === 'completed' ? 'secondary' : 'primary'}
            onClick={() => go('calibration')}
          >
            {t('summary.again')}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => go('dashboard')}>
            {t('summary.progress')}
          </Button>
          <Button size="lg" variant="ghost" onClick={() => go('home')}>
            {t('summary.home')}
          </Button>
        </div>
      </div>

      {score === null ? (
        <Card className="p-8">
          <p className="text-xl">{t('summary.noReps')}</p>
        </Card>
      ) : (
        <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-12">
          <Card
            raised
            className="flex flex-col items-center gap-4.5 bg-[radial-gradient(circle_at_50%_30%,oklch(0.7_0.17_45/0.3),transparent_60%)] p-7.5 text-center lg:col-span-5 lg:row-span-2"
          >
            <Ring percent={score} summary={t('summary.ring', { score })} />
            {comparison && (
              <>
                {comparison.delta !== null ? (
                  <p
                    className={`flex h-9 items-center gap-2 rounded-full px-4 text-sm font-bold ${
                      comparison.delta >= 0
                        ? 'bg-good/18 text-good-text'
                        : 'bg-bad/18 text-bad-text'
                    }`}
                  >
                    <span aria-hidden="true">{comparison.delta >= 0 ? '↑' : '↓'}</span>
                    {t('summary.delta', {
                      delta: `${comparison.delta >= 0 ? '+' : '-'}${Math.abs(comparison.delta)}`,
                      previous: comparison.previous ?? 0
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-mut">{t('summary.first')}</p>
                )}
                {comparison.best && <p className="text-[0.9375rem] text-t2">{t('summary.best')}</p>}
              </>
            )}
            {step && (
              <div className="anim-up mt-auto flex w-full items-center gap-3.5 rounded-3xl border border-brand/35 bg-sunk p-4 text-left [animation-delay:1300ms]">
                <span
                  aria-hidden="true"
                  className="relative flex size-10.5 shrink-0 items-center justify-center rounded-full bg-grad text-on-brand"
                >
                  {step.kind === 'completed' && (
                    <span
                      className="absolute inset-0 rounded-full border-2 border-accent"
                      style={{ animation: 'vy-burst 900ms ease-out 1500ms both' }}
                    />
                  )}
                  <Icon name="check" className="size-5" strokeWidth={2.4} />
                </span>
                <div>
                  <p className="text-[0.9375rem] font-bold">
                    {step.kind === 'completed'
                      ? t('summary.step.completed', { n: step.position })
                      : t('summary.step.counted', { n: step.position })}
                  </p>
                  {step.kind === 'counted' && (
                    <p className="text-[0.8125rem] text-mut">
                      {t('path.step.counted', { counted: step.counted, required: step.required })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-2 p-6 lg:col-span-7">
            <div>
              <p className="text-[0.8125rem] text-mut">
                {t(UNIT_TOTAL[unit], { count: summary.judged })}
              </p>
              <h2 className="mt-1 text-[1.1875rem] font-bold">
                {t('summary.counts', {
                  good: summary.good,
                  needsWork: summary.needsWork,
                  bad: summary.bad
                })}
              </h2>
              <p className="mt-1 text-[0.8125rem] text-mut">{t(UNIT_SEQUENCE[unit])}</p>
            </div>
            <RepNecklace
              qualities={qualities}
              labels={qualities.map((quality, index) =>
                t('dashboard.quality.rep', {
                  n: index + 1,
                  quality: t(
                    quality === 'good'
                      ? 'dashboard.quality.good'
                      : quality === 'warn'
                        ? 'dashboard.quality.warn'
                        : 'dashboard.quality.bad'
                  )
                })
              )}
              summary={t(UNIT_SEQUENCE[unit])}
            />
            <Breakdown good={summary.good} needsWork={summary.needsWork} bad={summary.bad} />
            {summary.judged < SHORT_SESSION_REPS && (
              <p className="text-sm text-mut">{t('summary.short')}</p>
            )}
            {unjudged > 0 && (
              <p className="text-sm text-mut">{t('summary.unjudged', { count: unjudged })}</p>
            )}
          </Card>

          {rows.length > 0 && (
            <Card className="flex flex-col gap-3 p-6 lg:col-span-7">
              <p className="text-[0.8125rem] text-mut">{t('summary.measures')}</p>
              <ul className="flex flex-col gap-2.5">
                {rows.map((row) => (
                  <li key={row.label} className="flex flex-wrap items-baseline gap-x-3">
                    <span className="text-base text-t4">{t(row.label)}</span>
                    <span className="font-display text-2xl font-bold tabular-nums">
                      {row.value}
                    </span>
                    {row.before && (
                      <span className="text-sm text-mut">
                        {row.trend === 'better' && <span aria-hidden="true">↑ </span>}
                        {row.trend === 'worse' && <span aria-hidden="true">↓ </span>}
                        {t('summary.measure.before', { value: row.before })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="flex flex-col gap-4 p-5.5 lg:col-span-3 lg:col-start-6">
            <p className="text-[0.8125rem] text-mut">{t('summary.errors')}</p>
            {topError ? (
              <>
                <Corrections
                  most={Math.max(1, ...summary.errors.map((error) => error.count))}
                  rows={summary.errors.map((error) => ({
                    key: error.ruleId,
                    message: localize(error.message),
                    count: error.count,
                    channel: ruleChannel(skill, error.ruleId)
                  }))}
                />
                <p className="mt-auto rounded-2xl bg-sunk p-3.5 text-sm leading-normal text-t2">
                  <span className="font-bold text-t1">{t('summary.tip')}</span>{' '}
                  {localize(topError.message)}
                </p>
              </>
            ) : (
              <p className="text-base">{t('summary.noErrors')}</p>
            )}
          </Card>

          {digest && (
            <Card className="p-5.5 lg:col-span-4">
              <CoachSummary key={digest.startedAt} digest={digest} />
            </Card>
          )}
        </div>
      )}
    </section>
  )
}
