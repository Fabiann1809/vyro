import { linePath, seriesPoints } from './geometry'

const FRAME = { width: 100, height: 28, padX: 2, padY: 3 }

// A tiny line with no axes, for a row of a list: only the shape of it.
export function Sparkline({ values }: { values: readonly number[] }): React.JSX.Element {
  const path = linePath(seriesPoints(values, FRAME, { min: 0, max: 1 }))
  return (
    <svg
      viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      aria-hidden="true"
      className="h-7 w-full overflow-visible"
    >
      <path
        d={path}
        className="fill-none stroke-accent"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
