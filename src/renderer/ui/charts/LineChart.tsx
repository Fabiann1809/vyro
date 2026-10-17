import { t } from '@renderer/i18n'
import {
  areaPath,
  bestIndex,
  linePath,
  pathLength,
  pickLabels,
  seriesPoints,
  ticks,
  trend,
  yOf,
  type Frame,
  type Range
} from './geometry'
import { useDrawn } from './useDrawn'

const WIDTH = 640
const HEIGHT = 200
const FRAME: Frame = { width: WIDTH, height: HEIGHT, padX: 44, padY: 14 }

// A series over time: the line draws itself from left to right, a dashed line shows where it is
// heading, and the best mark is named. The data is also there as a table for screen readers.
export function LineChart({
  values,
  labels,
  range = { min: 40, max: 100 },
  summary,
  seriesName
}: {
  values: readonly number[]
  // What each value is called: a date. Same length as the values.
  labels: readonly string[]
  range?: Range
  // One sentence that says what the chart shows, for screen readers.
  summary: string
  seriesName: string
}): React.JSX.Element {
  const drawn = useDrawn()
  const points = seriesPoints(values, FRAME, range)
  const length = pathLength(points)
  const line = trend(values)
  const best = bestIndex(values)
  const bestPoint = points[best]
  const grid = ticks(range)
    .map((tick) => `M${FRAME.padX - 8} ${yOf(tick, FRAME, range).toFixed(1)}H${WIDTH}`)
    .join('')
  const first = points[0]
  const last = points[points.length - 1]

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div role="img" aria-label={summary} className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full overflow-visible">
          <path d={grid} className="fill-none stroke-line/6" strokeWidth={1} />
          <path
            d={areaPath(points, HEIGHT)}
            className="fill-brand/7 transition-opacity duration-700"
            style={{ opacity: drawn ? 1 : 0 }}
          />
          {line && first && last && (
            <path
              d={`M${first.x} ${yOf(line.first, FRAME, range).toFixed(1)} L${last.x} ${yOf(line.last, FRAME, range).toFixed(1)}`}
              className="fill-none stroke-mut"
              strokeWidth={1.5}
              strokeDasharray="4 5"
              opacity={0.7}
            />
          )}
          <path
            d={linePath(points)}
            className="fill-none stroke-brand"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={length}
            strokeDashoffset={drawn ? 0 : length}
            style={{ transition: 'stroke-dashoffset 1100ms cubic-bezier(0.3, 0.7, 0.2, 1)' }}
          />
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={3.5}
              className="fill-card stroke-brand transition-opacity delay-700 duration-500"
              strokeWidth={2}
              style={{ opacity: drawn ? 1 : 0 }}
            />
          ))}
          {bestPoint && (
            <circle
              cx={bestPoint.x}
              cy={bestPoint.y}
              r={7}
              className="fill-brand stroke-card"
              strokeWidth={3}
            />
          )}
        </svg>
        {ticks(range).map((tick) => (
          <span
            key={tick}
            aria-hidden="true"
            className="absolute left-0 -translate-y-1/2 text-[0.6875rem] text-mut2"
            style={{ top: `${(yOf(tick, FRAME, range) / HEIGHT) * 100}%` }}
          >
            {Math.round(tick)}
          </span>
        ))}
        {bestPoint && (
          <span
            aria-hidden="true"
            className="absolute -translate-x-1/2 -translate-y-[150%] rounded-full bg-t1 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-inv"
            style={{
              left: `${(bestPoint.x / WIDTH) * 100}%`,
              top: `${(bestPoint.y / HEIGHT) * 100}%`
            }}
          >
            {t('chart.best', { value: Math.round(values[best]!) })}
          </span>
        )}
      </div>
      <div aria-hidden="true" className="flex justify-between pl-9 text-[0.71875rem] text-mut2">
        {pickLabels(labels).map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      <div aria-hidden="true" className="flex gap-4.5 text-xs text-mut">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-brand" />
          {seriesName}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-mut" />
          {t('chart.trend')}
        </span>
      </div>
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th>{t('chart.table.when')}</th>
            <th>{seriesName}</th>
          </tr>
        </thead>
        <tbody>
          {values.map((value, index) => (
            <tr key={index}>
              <td>{labels[index]}</td>
              <td>{Math.round(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
