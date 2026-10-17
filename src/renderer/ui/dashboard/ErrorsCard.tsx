import { localize, t } from '@renderer/i18n'
import { EmptyChart } from '../charts/EmptyChart'
import { HBars, type HBarRow } from '../charts/HBars'
import type { ErrorRow } from '../dashboardData'
import { Card } from '../kit/Card'
import { ChannelMark } from '../kit/ChannelChip'
import { CHANNEL_LOOK } from '../kit/channels'

// How the count of a rule moved against the four weeks before. A rule that was not failed before
// has nothing to compare with, so it says nothing.
function changeOf(row: ErrorRow, hasBefore: boolean): HBarRow['change'] {
  if (!hasBefore) return undefined
  const difference = row.count - row.before
  if (difference === 0) return { text: t('dashboard.errors.same'), tone: 'same' }
  return difference < 0
    ? { text: t('dashboard.errors.fewer', { count: -difference }), tone: 'better' }
    : { text: t('dashboard.errors.more', { count: difference }), tone: 'worse' }
}

// The rules that were failed most in the last four weeks, with the part of the body, hands, object
// or sound each one is about.
export function ErrorsCard({
  rows,
  hasBefore
}: {
  rows: readonly ErrorRow[]
  // Whether there are sessions in the four weeks before to compare with.
  hasBefore: boolean
}): React.JSX.Element {
  const top = rows[0]

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div>
        <p className="text-[0.8125rem] text-mut">{t('dashboard.errors.label')}</p>
        <h2 className="mt-1 text-[1.1875rem] font-semibold">
          {top
            ? t('dashboard.errors.top', { message: localize(top.message) })
            : t('dashboard.errors.noneTitle')}
        </h2>
      </div>
      {top ? (
        <HBars
          rows={rows.map((row) => ({
            key: `${row.skillId}/${row.ruleId}`,
            label: localize(row.message),
            value: t('dashboard.errors.count', { count: row.count }),
            count: row.count,
            fill: CHANNEL_LOOK[row.channel].fill,
            mark: <ChannelMark channel={row.channel} className="size-3.5" />,
            change: changeOf(row, hasBefore)
          }))}
        />
      ) : (
        <EmptyChart message={t('dashboard.errors.none')} />
      )}
    </Card>
  )
}
