import { useState } from 'react'
import { t } from '@renderer/i18n'
import {
  areaPath,
  bestIndex,
  fitRange,
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
const HEIGHT = 240
// The left side has room for the numbers of the scale; the right side only for the last dot.
const FRAME: Frame = { width: WIDTH, height: HEIGHT, padX: 44, padRight: 14, padY: 14 }

// A series over time: the line draws itself from left to right, a dashed line shows where it is
// heading, and the best mark is named. The data is also there as a table for screen readers.
export function LineChart({
  values,
  labels,
  range: fixedRange,
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
  const [hovered, setHovered] = useState<number | null>(null)
  // Left to itself, the scale grows downwards for a low score instead of drawing it outside.
  const range = fixedRange ?? fitRange(values)
  const points = seriesPoints(values, FRAME, range)
  const length = pathLength(points)
  const line = trend(values)
  const best = bestIndex(values)
  const grid = ticks(range)
    .map((tick) => `M${FRAME.padX - 8} ${yOf(tick, FRAME, range).toFixed(1)}H${WIDTH}`)
    .join('')
  const first = points[0]
  const last = points[points.length - 1]
  const marked = hovered ?? best
  const markedPoint = points[marked]

  // The mouse picks the nearest point by its place across the chart.
  const follow = (event: React.MouseEvent<HTMLDivElement>): void => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * WIDTH
    let nearest = 0
    points.forEach((point, index) => {
      if (Math.abs(point.x - x) < Math.abs(points[nearest]!.x - x)) nearest = index
    })
    if (nearest !== hovered) setHovered(nearest)
  }

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div
        role="img"
        aria-label={summary}
        className="relative cursor-crosshair"
        onMouseMove={follow}
        onMouseLeave={() => setHovered(null)}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full overflow-visible">
          <defs>
            <linearGradient id="vy-line-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#FFD1A0" />
              <stop offset="0.5" stopColor="#F27A3E" />
              <stop offset="1" stopColor="#D2497A" />
            </linearGradient>
            <linearGradient id="vy-line-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="oklch(0.74 0.17 45)" stopOpacity="0.38" />
              <stop offset="1" stopColor="oklch(0.74 0.17 45)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={grid}
            className="fill-none stroke-line/14"
            strokeWidth={1}
            strokeDasharray="2 6"
          />
          <path
            d={areaPath(points, HEIGHT - FRAME.padY)}
            fill="url(#vy-line-area)"
            className="transition-opacity duration-700"
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
            stroke="url(#vy-line-stroke)"
            className="fill-none"
            strokeWidth={3.5}
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
              className="fill-bg stroke-accent transition-opacity delay-700 duration-500"
              strokeWidth={2}
              style={{ opacity: drawn ? 1 : 0 }}
            />
          ))}
        </svg>
        {markedPoint && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 -ml-4.5 w-9 rounded-[1.125rem] bg-linear-to-b from-brand/32 to-transparent transition-[left,top] duration-300"
              style={{
                left: `${(markedPoint.x / WIDTH) * 100}%`,
                top: `${(markedPoint.y / HEIGHT) * 100}%`
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -m-2.25 size-4.5 rounded-full bg-[#fff4ea] shadow-[0_0_0_5px_oklch(0.74_0.17_45/0.35),0_0_24px_oklch(0.74_0.17_45/0.8)] transition-[left,top] duration-300"
              style={{
                left: `${(markedPoint.x / WIDTH) * 100}%`,
                top: `${(markedPoint.y / HEIGHT) * 100}%`
              }}
            />
          </>
        )}
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
        {markedPoint && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-[190%] rounded-full bg-t1 px-3 py-1 text-[0.8125rem] font-bold whitespace-nowrap text-inv transition-[left,top] duration-300"
            style={{
              left: `${(markedPoint.x / WIDTH) * 100}%`,
              top: `${(markedPoint.y / HEIGHT) * 100}%`
            }}
          >
            {marked === best
              ? t('chart.best', { value: Math.round(values[best]!) })
              : `${labels[marked]} · ${Math.round(values[marked]!)}`}
          </span>
        )}
      </div>
      <div
        aria-hidden="true"
        className="flex justify-between pr-1 pl-9 text-[0.71875rem] text-mut2"
      >
        {pickLabels(labels).map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      <div aria-hidden="true" className="flex gap-4.5 text-xs text-mut">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-grad" />
          {seriesName}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-mut" />
          {t('chart.trend')}
        </span>
      </div>
      {/* The wrapper hides it: a table keeps its own width even with sr-only on it. */}
      <div className="sr-only">
        <table>
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
      </div>
    </figure>
  )
}
