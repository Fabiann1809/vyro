import { t } from '@renderer/i18n'
import { BandChart } from '../charts/BandChart'
import { EmptyChart } from '../charts/EmptyChart'
import type { ChannelSeries } from '../dashboardData'
import { Card } from '../kit/Card'
import { ChannelChip } from '../kit/ChannelChip'
import { CHANNEL_LOOK } from '../kit/channels'

// The aim: failing at most this share of the repetitions.
const TARGET = 20

function conclusion(rates: readonly number[]): 'better' | 'worse' | 'steady' | 'few' {
  const first = rates[0]
  const last = rates[rates.length - 1]
  if (first === undefined || last === undefined || rates.length < 2) return 'few'
  return last < first ? 'better' : last > first ? 'worse' : 'steady'
}

function ChannelCard({ series }: { series: ChannelSeries }): React.JSX.Element {
  const look = CHANNEL_LOOK[series.channel]
  const last = series.rates[series.rates.length - 1] ?? 0
  const verdict = conclusion(series.rates)
  const name = t(look.label)

  return (
    <Card className="flex flex-col gap-3 p-5">
      <span className="self-start">
        <ChannelChip channel={series.channel} />
      </span>
      <div>
        <p className="text-[0.78rem] text-mut">{t('dashboard.channels.metric')}</p>
        <h3 className="mt-0.75 text-base font-semibold text-pretty">
          {t(`dashboard.channels.${verdict}`)}
        </h3>
      </div>
      {series.rates.length >= 2 ? (
        <div className={look.text}>
          <BandChart
            values={series.rates}
            range={{ min: 0, max: 100 }}
            band={{ min: 0, max: TARGET }}
            summary={t('dashboard.channels.summary', {
              channel: name,
              values: series.rates.join(', ')
            })}
          />
        </div>
      ) : (
        <EmptyChart message={t('progress.needMore')} />
      )}
      <p className="text-[0.78rem] text-t4">
        {t('dashboard.channels.note', { rate: last, target: TARGET })}
      </p>
    </Card>
  )
}

// One small chart for each channel the practice has used: how often it failed, session by session.
export function ChannelCards({ series }: { series: readonly ChannelSeries[] }): React.JSX.Element {
  return (
    <>
      <div className="flex items-baseline justify-between lg:col-span-3">
        <h2 className="text-[1.1875rem] font-semibold">{t('dashboard.channels.title')}</h2>
        <p className="text-[0.8125rem] text-mut">{t('dashboard.channels.hint')}</p>
      </div>
      <ul className="grid grid-cols-2 gap-4.5 lg:col-span-3 lg:grid-cols-4">
        {series.map((item) => (
          <li key={item.channel} className="flex">
            <ChannelCard series={item} />
          </li>
        ))}
      </ul>
    </>
  )
}
