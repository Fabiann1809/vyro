import { useEffect, useState } from 'react'
import {
  buildSessionDigest,
  sessionNumbers,
  summarizeSession,
  type SessionNumbers
} from '@renderer/engine/sessionSummary'
import { localize, t } from '@renderer/i18n'
import { ruleChannel } from '@shared/skill/ruleChannels'
import { HBars } from '../charts/HBars'
import { QualityBars } from '../charts/QualityBars'
import { Ring } from '../charts/Ring'
import { SegmentedBar } from '../charts/SegmentedBar'
import { toChartQuality } from '../dashboardData'
import { CoachSummary } from '../CoachSummary'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'
import { ChannelMark } from '../kit/ChannelChip'
import { CHANNEL_LOOK } from '../kit/channels'
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
    <section className="anim-fade mx-auto flex h-full w-full max-w-310 flex-col gap-4.5 self-start overflow-y-auto px-8 pt-7 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1>
            <span className="block text-sm font-normal text-mut">
              {t('screen.summary.title')} ·{' '}
              {t('summary.duration', { time: clock(finished.durationMs) })}
            </span>
            <span className="mt-1.5 block font-display text-[2.125rem] leading-tight font-semibold tracking-tight">
              {name}
            </span>
          </h1>
          {(saveStatus === 'saved' || saveStatus === 'failed') && (
            <p role="status" className="mt-1.5 text-sm text-mut">
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
        <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-3">
          <Card raised className="flex flex-col items-center gap-5 p-7 text-center lg:row-span-2">
            <Ring percent={score} summary={t('summary.ring', { score })} />
            {comparison && (
              <>
                {comparison.delta !== null ? (
                  <p
                    className={`flex h-8.5 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ${
                      comparison.delta >= 0
                        ? 'bg-good/15 text-good-text'
                        : 'bg-bad/15 text-bad-text'
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
                {comparison.best && <p className="text-[0.9375rem] text-t4">{t('summary.best')}</p>}
              </>
            )}
            {step && (
              <div className="anim-up mt-auto flex w-full items-center gap-3 rounded-2xl border border-brand/35 p-4 text-left">
                <span
                  aria-hidden="true"
                  className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand"
                >
                  {step.kind === 'completed' && (
                    <span
                      className="absolute inset-0 rounded-full border-2 border-brand"
                      style={{ animation: 'vy-burst 900ms ease-out 400ms both' }}
                    />
                  )}
                  <Icon name="check" className="size-4" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-[0.9rem] font-semibold">
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

          <Card className="flex flex-col gap-4.5 p-6 lg:col-span-2">
            <div>
              <p className="text-[0.8125rem] text-mut">
                {t(UNIT_TOTAL[unit], { count: summary.judged })}
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {t('summary.counts', {
                  good: summary.good,
                  needsWork: summary.needsWork,
                  bad: summary.bad
                })}
              </h2>
            </div>
            <SegmentedBar
              summary={t('summary.counts', {
                good: summary.good,
                needsWork: summary.needsWork,
                bad: summary.bad
              })}
              segments={[
                {
                  quality: 'good',
                  count: summary.good,
                  label: t('summary.good', { count: summary.good })
                },
                {
                  quality: 'warn',
                  count: summary.needsWork,
                  label: t('summary.needsWork', { count: summary.needsWork })
                },
                {
                  quality: 'bad',
                  count: summary.bad,
                  label: t('summary.bad', { count: summary.bad })
                }
              ]}
            />
            {summary.judged < SHORT_SESSION_REPS && (
              <p className="text-sm text-mut">{t('summary.short')}</p>
            )}
            {unjudged > 0 && (
              <p className="text-sm text-mut">{t('summary.unjudged', { count: unjudged })}</p>
            )}
            <p className="text-[0.8125rem] text-mut">{t(UNIT_SEQUENCE[unit])}</p>
            <QualityBars
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
              height="h-24"
            />
          </Card>

          {rows.length > 0 && (
            <Card className="flex flex-col gap-3 p-6 lg:col-span-2">
              <p className="text-[0.8125rem] text-mut">{t('summary.measures')}</p>
              <ul className="flex flex-col gap-2.5">
                {rows.map((row) => (
                  <li key={row.label} className="flex flex-wrap items-baseline gap-x-3">
                    <span className="text-base text-t4">{t(row.label)}</span>
                    <span className="font-display text-2xl font-semibold tabular-nums">
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

          <Card className="flex flex-col gap-4 p-6">
            <p className="text-[0.8125rem] text-mut">{t('summary.errors')}</p>
            {topError ? (
              <>
                <HBars
                  rows={summary.errors.map((error) => {
                    const channel = ruleChannel(skill, error.ruleId)
                    return {
                      key: error.ruleId,
                      label: localize(error.message),
                      value: t('summary.times', { count: error.count }),
                      count: error.count,
                      fill: CHANNEL_LOOK[channel].fill,
                      mark: <ChannelMark channel={channel} className="size-3.5" />
                    }
                  })}
                />
                <p className="mt-auto rounded-2xl bg-sunk p-3.5 text-sm leading-normal text-t4">
                  <span className="font-semibold text-t1">{t('summary.tip')}</span>{' '}
                  {localize(topError.message)}
                </p>
              </>
            ) : (
              <p className="text-base">{t('summary.noErrors')}</p>
            )}
          </Card>

          {digest && (
            <Card className="p-6">
              <CoachSummary key={digest.startedAt} digest={digest} />
            </Card>
          )}
        </div>
      )}
    </section>
  )
}
