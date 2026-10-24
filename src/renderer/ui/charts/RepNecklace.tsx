import { useState } from 'react'
import { smoothCurve, type Point } from './curve'
import type { Quality } from './quality'

const WIDTH = 1100
const HEIGHT = 150

// How big each bead is and its colour. Never colour alone: the size tells good, so-so and bad apart.
const SIZE: Record<Quality, number> = { good: 26, warn: 19, bad: 13 }
const COLOR: Record<Quality, string> = {
  good: 'var(--good)',
  warn: 'var(--warn)',
  bad: 'var(--bad)'
}

// The repetitions of a session strung along a wavy thread, in order: a big bead is a good one, a
// small one a bad one. A technique that wears out shows as beads that shrink towards the end.
export function RepNecklace({
  qualities,
  labels,
  summary
}: {
  qualities: readonly Quality[]
  // What each bead says when it is pointed at: "Repetition 3: good".
  labels: readonly string[]
  summary: string
}): React.JSX.Element {
  const [hovered, setHovered] = useState<number | null>(null)
  const count = qualities.length
  const points: Point[] = qualities.map((_, index) => [
    30 + (count === 1 ? 0 : (index * (WIDTH - 60)) / (count - 1)),
    75 + Math.sin(index * 0.62) * 30
  ])
  const thread = smoothCurve(points)
  const at = hovered === null ? null : points[hovered]

  return (
    <div
      role="img"
      aria-label={summary}
      onMouseLeave={() => setHovered(null)}
      className="relative h-37.5 min-h-37.5 w-full"
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
      >
        <path
          d={thread.d}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeDasharray={thread.length}
          style={
            {
              '--dash': thread.length,
              animation: 'vy-trace 1.4s 300ms ease-out backwards'
            } as React.CSSProperties
          }
        />
      </svg>
      {qualities.map((quality, index) => {
        const [x, y] = points[index]!
        const size = SIZE[quality]
        return (
          <span
            key={index}
            title={labels[index]}
            onMouseEnter={() => setHovered(index)}
            className="absolute cursor-pointer rounded-full transition-transform duration-200 hover:scale-135"
            style={{
              left: `${(x / WIDTH) * 100}%`,
              top: `${(y / HEIGHT) * 100}%`,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.7), ${COLOR[quality]} 45%, color-mix(in oklab, ${COLOR[quality]} 80%, transparent))`,
              boxShadow:
                (hovered === index
                  ? '0 0 0 4px color-mix(in oklab, var(--line) 30%, transparent), '
                  : '') +
                (quality === 'good'
                  ? `0 0 18px color-mix(in oklab, ${COLOR[quality]} 60%, transparent)`
                  : '0 0 0 transparent'),
              animation: `vy-pop 500ms cubic-bezier(0.2, 0.8, 0.2, 1) ${200 + index * 40}ms both`
            }}
          />
        )
      })}
      {hovered !== null && at && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+22px)] rounded-2xl bg-t1 px-3.5 py-2 text-xs font-bold whitespace-nowrap text-inv"
          style={{ left: `${(at[0] / WIDTH) * 100}%`, top: `${(at[1] / HEIGHT) * 100}%` }}
        >
          {labels[hovered]}
        </span>
      )}
    </div>
  )
}
