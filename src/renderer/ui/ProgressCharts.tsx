import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { currentLanguage, t } from '@renderer/i18n'
import type { SessionRow } from '@shared/sessions'
import { buildProgressSeries, MIN_SESSIONS_FOR_CHART } from './progressSeries'

// Different shapes as well as different colors: bars for repetitions, a line for the score.
const GOOD_REPS_COLOR = '#10b981'
const SCORE_COLOR = '#0ea5e9'

const formatDay = (timestamp: number): string =>
  new Intl.DateTimeFormat(currentLanguage(), { day: 'numeric', month: 'short' }).format(timestamp)

// Evolution of one exercise: good repetitions and score, session after session.
export function ProgressCharts({
  sessions
}: {
  sessions: readonly SessionRow[]
}): React.JSX.Element {
  const series = buildProgressSeries(sessions)

  if (series.length < MIN_SESSIONS_FOR_CHART) {
    return <p className="text-slate-600 dark:text-slate-400">{t('progress.needMore')}</p>
  }

  const data = series.map((point, index) => ({
    session: index + 1,
    day: formatDay(point.startedAt),
    goodReps: point.goodReps,
    score: point.score
  }))

  return (
    <div role="img" aria-label={t('progress.chartLabel')} className="h-72 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="day" stroke="currentColor" />
          <YAxis yAxisId="reps" allowDecimals={false} stroke={GOOD_REPS_COLOR} />
          <YAxis yAxisId="score" orientation="right" domain={[0, 100]} stroke={SCORE_COLOR} />
          <Tooltip />
          <Legend />
          <Bar
            yAxisId="reps"
            dataKey="goodReps"
            name={t('progress.goodReps')}
            fill={GOOD_REPS_COLOR}
            isAnimationActive={false}
          />
          <Line
            yAxisId="score"
            dataKey="score"
            name={t('progress.score')}
            stroke={SCORE_COLOR}
            strokeWidth={3}
            dot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
