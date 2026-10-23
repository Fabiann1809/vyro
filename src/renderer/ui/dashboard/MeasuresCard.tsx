import { t, type MessageKey } from '@renderer/i18n'
import { BandChart } from '../charts/BandChart'
import { EmptyChart } from '../charts/EmptyChart'
import type { MeasureSeries, SeriesMeasure } from '../dashboardUnits'
import { Card } from '../kit/Card'

const LABEL: Record<SeriesMeasure, MessageKey> = {
  cleanRate: 'summary.measure.cleanRate',
  timeWell: 'summary.measure.timeWell',
  bestStreak: 'summary.measure.bestStreak'
}

const show = (measure: SeriesMeasure, value: number): string =>
  measure === 'bestStreak' ? `${value} s` : `${value} %`

function conclusion(values: readonly number[]): 'better' | 'worse' | 'steady' | 'few' {
  const first = values[0]
  const last = values[values.length - 1]
  if (first === undefined || last === undefined || values.length < 2) return 'few'
  return last > first ? 'better' : last < first ? 'worse' : 'steady'
}

function MeasureCard({ series }: { series: MeasureSeries }): React.JSX.Element {
  const last = series.values[series.values.length - 1] ?? 0
  // Percentages are aimed at their top fifth; a streak at the top fifth of the best one so far.
  const top = series.measure === 'bestStreak' ? Math.max(...series.values, 1) : 100

  return (
    <Card className="flex w-full flex-col gap-3 p-5 text-good">
      <div className="text-t1">
        <p className="text-[0.78rem] text-mut">{t(LABEL[series.measure])}</p>
        <h3 className="mt-0.75 text-base font-semibold text-pretty">
          {t(`dashboard.measures.${conclusion(series.values)}`)}
        </h3>
      </div>
      {series.values.length >= 2 ? (
        <BandChart
          values={series.values}
          range={{ min: 0, max: top }}
          band={{ min: top * 0.8, max: top }}
          summary={t('dashboard.measures.summary', {
            measure: t(LABEL[series.measure]),
            values: series.values.map((value) => show(series.measure, value)).join(', ')
          })}
        />
      ) : (
        <EmptyChart message={t('progress.needMore')} />
      )}
      <p className="text-[0.78rem] text-t4">
        {t('dashboard.measures.note', { value: show(series.measure, last) })}
      </p>
    </Card>
  )
}

// One small chart for each measure the skill declares: how it went, session after session.
export function MeasuresCards({ series }: { series: readonly MeasureSeries[] }): React.JSX.Element {
  return (
    <>
      <div className="flex items-baseline justify-between lg:col-span-3">
        <h2 className="text-[1.1875rem] font-semibold">{t('dashboard.measures.title')}</h2>
        <p className="text-[0.8125rem] text-mut">{t('dashboard.measures.hint')}</p>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4.5 lg:col-span-3">
        {series.map((item) => (
          <li key={item.measure} className="flex">
            <MeasureCard series={item} />
          </li>
        ))}
      </ul>
    </>
  )
}
