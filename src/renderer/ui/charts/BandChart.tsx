import { linePath, pathLength, seriesPoints, yOf, type Frame, type Range } from './geometry'
import { useDrawn } from './useDrawn'

const FRAME: Frame = { width: 260, height: 80, padX: 6, padY: 6 }

// A small line over time with the zone that is the aim shaded behind it, so that it is plain at
// a glance whether the last values are inside or out. The colour comes from the text colour of the
// parent (the channel's), so one chart serves every channel.
export function BandChart({
  values,
  range,
  band,
  summary
}: {
  values: readonly number[]
  range: Range
  // The aim: values inside it are good.
  band: Range
  summary: string
}): React.JSX.Element {
  const drawn = useDrawn()
  const points = seriesPoints(values, FRAME, range)
  const length = pathLength(points)
  const last = points[points.length - 1]
  const top = yOf(band.max, FRAME, range)
  const bottom = yOf(band.min, FRAME, range)

  return (
    <svg
      viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      role="img"
      aria-label={summary}
      className="block h-auto w-full overflow-visible"
    >
      <rect
        x={0}
        y={top}
        width={FRAME.width}
        height={bottom - top}
        rx={6}
        className="fill-current opacity-13"
      />
      <path
        d={linePath(points)}
        className="fill-none stroke-current"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={length}
        strokeDashoffset={drawn ? 0 : length}
        style={{ transition: 'stroke-dashoffset 1100ms cubic-bezier(0.3, 0.7, 0.2, 1) 200ms' }}
      />
      {last && (
        <circle
          cx={last.x}
          cy={last.y}
          r={4.5}
          className="fill-current stroke-card"
          strokeWidth={2}
        />
      )}
    </svg>
  )
}
