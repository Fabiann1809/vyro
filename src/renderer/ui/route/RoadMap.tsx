import { smoothCurve, type Point } from '../charts/curve'
import { Icon } from '../kit/Icon'
import type { IconName } from '../kit/icons'

export type StopState = 'done' | 'current' | 'open' | 'locked'

export interface Stop {
  key: string
  label: string
  icon: IconName
  state: StopState
  // The colour of the stop when it is not done or locked: a text colour class such as "text-ch-body".
  tone: string
  // A step of rest or reading, drawn with a dashed edge.
  auxiliary?: boolean
  // What a screen reader hears after the label (for example that the step is not measured).
  note?: string
}

const WIDTH = 640
const HEIGHT = 160
// The road goes up and down so that the labels of neighbours do not share a line.
const WAVE = [60, 22, 70, 24, 58]

function pointsFor(count: number): Point[] {
  const inner = WIDTH - 80
  return Array.from({ length: count }, (_, index) => [
    count === 1 ? WIDTH / 2 : 40 + (index * inner) / (count - 1),
    WAVE[index % WAVE.length]!
  ])
}

const NODE: Record<StopState, string> = {
  done: 'border-transparent bg-grad text-on-brand',
  current: 'border-brand text-accent shadow-[0_0_40px_oklch(0.74_0.17_45/0.5)]',
  open: 'border-current',
  locked: 'border-line/20 text-mut3 opacity-70'
}

// A road with a stop for each step: the part already walked is drawn in the colour of the brand,
// the step where the person is pulses. It draws itself when it appears.
export function RoadMap({
  stops,
  walked
}: {
  stops: readonly Stop[]
  // How many of the stops the line has walked to, in colour. Left out, the whole line is coloured
  // (a path that is only proposed).
  walked?: number
}): React.JSX.Element {
  const points = pointsFor(stops.length)
  const road = smoothCurve(points)
  const painted =
    walked === undefined ? road.length : (road.reach[Math.min(walked, stops.length - 1)] ?? 0)

  return (
    <div className="relative pb-9">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        aria-hidden="true"
        className="block w-full overflow-visible"
      >
        <defs>
          <linearGradient id="vy-road" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FFD1A0" />
            <stop offset="0.5" stopColor="#F27A3E" />
            <stop offset="1" stopColor="#D2497A" />
          </linearGradient>
        </defs>
        <path
          d={road.d}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d={road.d}
          fill="none"
          stroke="url(#vy-road)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={road.length}
          strokeDashoffset={road.length - painted}
          style={
            {
              '--dash': road.length,
              animation: 'vy-trace 1.6s 250ms cubic-bezier(0.3, 0.7, 0.2, 1) backwards'
            } as React.CSSProperties
          }
        />
      </svg>
      <ol className="contents">
        {stops.map((stop, index) => {
          const [x, y] = points[index]!
          return (
            <li
              key={stop.key}
              className="absolute size-0"
              style={{ left: `${(x / WIDTH) * 100}%`, top: `calc(${(y / HEIGHT) * 100}% * 0.84)` }}
            >
              <span
                className={`absolute -top-5.5 -left-5.5 flex size-11 items-center justify-center rounded-full border-2 bg-bg ${stop.auxiliary ? 'border-dashed' : ''} ${stop.state === 'open' || stop.state === 'current' ? stop.tone : ''} ${NODE[stop.state]}`}
                style={{
                  animation: `vy-pop 500ms cubic-bezier(0.2, 0.8, 0.2, 1) ${400 + index * 220}ms both`
                }}
              >
                <Icon name={stop.icon} className="size-5" strokeWidth={1.7} />
              </span>
              <span
                className="absolute top-7 -left-18.75 block w-37.5 text-center text-[0.78rem] leading-tight text-t2"
                style={{ animation: `vy-up 400ms ${400 + index * 220}ms both` }}
              >
                <span className="text-mut2">{index + 1} · </span>
                {stop.label}
                {stop.note && <span className="sr-only">, {stop.note}</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
