import { t } from '@renderer/i18n'
import type { SessionRow } from '@shared/sessions'
import { EmptyChart } from '../charts/EmptyChart'
import { Sunburst, type HeatCell } from '../charts/Sunburst'
import { heatmapDays, type HeatDay } from '../dashboardData'
import { Card } from '../kit/Card'
import { formatShortDay } from './format'

const WEEKS = 4

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
  now,
  streak
}: {
  sessions: readonly SessionRow[]
  now: number
  // The days in a row, ending today, with a session.
  streak: number
}): React.JSX.Element {
  const days = heatmapDays(sessions, now, WEEKS)
  const active = days.filter((day) => day.sessions > 0).length
  const total = days.reduce((sum, day) => sum + day.sessions, 0)

  return (
    <Card className="flex flex-col gap-4 p-6 lg:col-span-6">
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
        <Sunburst
          cells={days.map(cellOf)}
          big={String(streak)}
          unit={t(
            streak === 1 ? 'dashboard.consistency.dayInARow' : 'dashboard.consistency.daysInARow'
          )}
          summary={t('dashboard.consistency.title', { count: total, days: active })}
        />
      )}
      <p className="text-center text-[0.8125rem] text-t4">{t('dashboard.consistency.hover')}</p>
    </Card>
  )
}
