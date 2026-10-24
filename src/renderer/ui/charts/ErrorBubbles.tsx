import { bubbleDiameter, packBubbles } from './bubbles'

export interface Bubble {
  key: string
  label: string
  count: number
  // The count as it is said: "14 times".
  value: string
  // How it changed, in words; the tone says whether that is good news.
  change?: { text: string; tone: 'better' | 'worse' | 'same' }
  // A mark for the kind of thing it is about (a channel icon).
  mark?: React.ReactNode
  // A text colour class for the bubble's rim and glow.
  tint: string
}

const TONE: Record<'better' | 'worse' | 'same', string> = {
  better: 'text-good-text',
  worse: 'text-bad-text',
  same: 'text-mut'
}

const WIDTH = 330
const HEIGHT = 236

// What goes wrong most, as bubbles: the bigger, the more often. The bubbles are packed so none
// overlaps; what each one says is written inside it and, under it, how it changed.
export function ErrorBubbles({ rows }: { rows: readonly Bubble[] }): React.JSX.Element {
  const most = Math.max(1, ...rows.map((row) => row.count))
  const placed = packBubbles(
    rows.map((row) => bubbleDiameter(row.count, most)),
    WIDTH,
    HEIGHT
  )

  return (
    <ul className="relative mx-auto" style={{ width: WIDTH, height: HEIGHT }}>
      {rows.map((row, index) => {
        const spot = placed[index]!
        const size = spot.r * 2
        return (
          <li
            key={row.key}
            className={`absolute flex flex-col items-center justify-center rounded-full border border-current/40 bg-current/18 p-2 text-center shadow-[0_0_30px_color-mix(in_oklab,currentColor_25%,transparent)] transition-transform duration-300 hover:scale-105 ${row.tint}`}
            style={{
              left: spot.x - spot.r,
              top: spot.y - spot.r,
              width: size,
              height: size,
              animation: `vy-pop 600ms cubic-bezier(0.2, 0.8, 0.2, 1) ${200 + index * 120}ms both`
            }}
          >
            <span className="flex items-center gap-1 font-display text-[1.75rem] leading-none font-extrabold text-t1">
              {row.mark}
              {row.count}
            </span>
            <span className="mt-1 line-clamp-3 text-[0.72rem] leading-tight font-semibold text-t1">
              {row.label}
            </span>
            <span className="sr-only">
              {row.value}
              {row.change ? `, ${row.change.text}` : ''}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// The changes of the bubbles, in words, under the chart: bubbles cannot say it all.
export function BubbleChanges({ rows }: { rows: readonly Bubble[] }): React.JSX.Element | null {
  const changed = rows.filter((row) => row.change)
  if (changed.length === 0) return null
  return (
    <ul className="flex flex-col gap-1.5 rounded-2xl bg-sunk p-3.5 text-[0.84rem] leading-snug text-t2">
      {changed.map((row) => (
        <li key={row.key}>
          <span className={`font-bold ${TONE[row.change!.tone]}`}>{row.change!.text}</span> ·{' '}
          {row.label}
        </li>
      ))}
    </ul>
  )
}
