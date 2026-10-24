import { useState } from 'react'
import { t } from '@renderer/i18n'
import type { SessionRow } from '@shared/sessions'
import { EmptyChart } from '../charts/EmptyChart'
import { LineChart } from '../charts/LineChart'
import { scorePoints, scoreStory, type ScoreRange, type ScoreStory } from '../dashboardData'
import { Card } from '../kit/Card'
import { formatShortDay } from './format'

const RANGES: readonly ScoreRange[] = ['7', '30', 'all']

function headline(story: ScoreStory, range: ScoreRange): { title: string; sub: string } {
  switch (story.kind) {
    case 'none':
      return { title: t('dashboard.score.none'), sub: t('dashboard.score.noneSub') }
    case 'one':
      return {
        title: t('dashboard.score.one', { score: story.score }),
        sub: t('progress.needMore')
      }
    case 'rise':
    case 'drop':
    case 'flat': {
      const week = range === '7'
      const values = { delta: story.delta, count: story.count }
      const title =
        story.kind === 'rise'
          ? t(week ? 'dashboard.score.rise.week' : 'dashboard.score.rise.period', values)
          : story.kind === 'drop'
            ? t(week ? 'dashboard.score.drop.week' : 'dashboard.score.drop.period', values)
            : t('dashboard.score.flat', { last: story.last })
      return { title, sub: t('dashboard.score.span', { first: story.first, last: story.last }) }
    }
  }
}

// The score of each session over time, with the trend and the best mark.
export function ScoreCard({
  sessions,
  now
}: {
  sessions: readonly SessionRow[]
  now: number
}): React.JSX.Element {
  const [range, setRange] = useState<ScoreRange>('30')
  const points = scorePoints(sessions, range, now)
  const { title, sub } = headline(scoreStory(points), range)
  const last = points[points.length - 1]
  const before = points[points.length - 2]

  return (
    <Card className="flex flex-col gap-4 p-6 lg:col-span-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.8125rem] text-mut">{t('dashboard.score.label')}</p>
          <h2 className="mt-1 text-[1.3125rem] font-bold">{title}</h2>
          <p className="mt-1 text-sm text-mut">{sub}</p>
        </div>
        <div
          role="group"
          aria-label={t('dashboard.range.label')}
          className="flex shrink-0 gap-1 rounded-full bg-sunk p-0.75"
        >
          {RANGES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={range === option}
              onClick={() => setRange(option)}
              className="h-8 rounded-full px-3.5 text-[0.78rem] font-semibold whitespace-nowrap text-mut transition-all duration-200 aria-pressed:bg-grad aria-pressed:text-on-brand"
            >
              {t(`dashboard.range.${option}`)}
            </button>
          ))}
        </div>
      </div>

      {last && (
        <div className="flex items-end gap-3.5">
          <p className="font-display text-[4rem] leading-[0.85] font-bold tracking-[-0.04em] tabular-nums">
            {last.score}
          </p>
          <div className="flex flex-col gap-1.5 pb-1">
            {before && (
              <span
                className={`flex h-6.5 items-center self-start rounded-full px-2.5 text-[0.78rem] font-bold ${
                  last.score >= before.score
                    ? 'bg-good/18 text-good-text'
                    : 'bg-bad/18 text-bad-text'
                }`}
              >
                <span aria-hidden="true">{last.score >= before.score ? '↑ ' : '↓ '}</span>
                {t('dashboard.score.delta', {
                  delta: `${last.score >= before.score ? '+' : '-'}${Math.abs(last.score - before.score)}`
                })}
              </span>
            )}
            <span className="text-[0.8125rem] text-mut">{formatShortDay(last.startedAt)}</span>
          </div>
        </div>
      )}

      {points.length >= 2 ? (
        <LineChart
          key={range}
          values={points.map((point) => point.score)}
          labels={points.map((point) => formatShortDay(point.startedAt))}
          summary={t('dashboard.score.summary', {
            values: points.map((point) => point.score).join(', ')
          })}
          seriesName={t('dashboard.score.series')}
        />
      ) : (
        <EmptyChart
          message={t(points.length === 0 ? 'dashboard.score.empty' : 'progress.needMore')}
        />
      )}
    </Card>
  )
}
