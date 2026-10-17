import { t } from '@renderer/i18n'
import type { SessionRow } from '@shared/sessions'
import { EmptyChart } from '../charts/EmptyChart'
import { Heatmap, type HeatCell } from '../charts/Heatmap'
import { heatmapDays, type HeatDay } from '../dashboardData'
import { Card } from '../kit/Card'
import { formatShortDay } from './format'

const WEEKS = 12

function cellOf(day: HeatDay): HeatCell {
  const when = formatShortDay(day.date)
  return {
    key: day.key,
    level: day.level,
    streak: day.streak,
    title:
      day.sessions === 0
        ? t('dashboard.consistency.noSession', { date: when })
        : day.score === null
          ? t('dashboard.consistency.noScore', { date: when })
          : t('dashboard.consistency.score', { date: when, score: day.score })
  }
}

// A calendar of the last weeks, a square a day: the darker, the better that day went.
export function ConsistencyCard({
  sessions,
  now
}: {
  sessions: readonly SessionRow[]
  now: number
}): React.JSX.Element {
  const days = heatmapDays(sessions, now, WEEKS)
  const active = days.filter((day) => day.sessions > 0).length
  const total = days.reduce((sum, day) => sum + day.sessions, 0)

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div>
        <p className="text-[0.8125rem] text-mut">
          {t('dashboard.consistency.label', { weeks: WEEKS })}
        </p>
        <h2 className="mt-1 text-[1.1875rem] font-semibold">
          {t('dashboard.consistency.title', { count: total, days: active })}
        </h2>
      </div>
      {total === 0 ? (
        <EmptyChart message={t('dashboard.consistency.empty')} />
      ) : (
        <Heatmap
          cells={days.map(cellOf)}
          summary={t('dashboard.consistency.title', { count: total, days: active })}
        />
      )}
      <div className="flex items-center justify-between text-xs text-mut2">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] shadow-[inset_0_0_0_1.5px_var(--t1)]" />
          {t('dashboard.consistency.streak')}
        </span>
        <span aria-hidden="true" className="flex items-center gap-1">
          {t('dashboard.consistency.less')}
          <span className="size-2.5 rounded-[3px] bg-empty" />
          <span className="size-2.5 rounded-[3px] bg-good/30" />
          <span className="size-2.5 rounded-[3px] bg-good/60" />
          <span className="size-2.5 rounded-[3px] bg-good" />
          {t('dashboard.consistency.more')}
        </span>
      </div>
    </Card>
  )
}
