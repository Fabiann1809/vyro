import { useState } from 'react'
export type HeatLevel = 0 | 1 | 2 | 3

export interface HeatCell {
  key: string
  // What it says when pointed at: "17 oct · score 78".
  title: string
  level: HeatLevel
  // The days of the current streak are drawn in the gradient of the brand.
  streak: boolean
}

const HEIGHT: Record<HeatCell['level'], number> = { 0: 16, 1: 22, 2: 26, 3: 32 }
const FILL: Record<HeatCell['level'], string> = {
  0: 'bg-line/14',
  1: 'bg-brand/45',
  2: 'bg-brand/75',
  3: 'bg-brand'
}

// The last days as rays around a glowing core, one ray a day: a longer, brighter ray is a better
// day, and the days of the streak are drawn in the gradient of the brand. Pointing at a ray says
// what happened that day. The days are also listed for screen readers.
export function Sunburst({
  cells,
  big,
  unit,
  summary
}: {
  cells: readonly HeatCell[]
  // What the middle says when nothing is pointed at: the streak.
  big: string
  unit: string
  summary: string
}): React.JSX.Element {
  const [hovered, setHovered] = useState<number | null>(null)
  const cell = hovered === null ? null : cells[hovered]

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="img"
        aria-label={summary}
        onMouseLeave={() => setHovered(null)}
        className="relative size-57.5"
      >
        <div className="absolute inset-14.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffc98f,#f27a3e_45%,#a8326a)] opacity-85 shadow-[0_0_60px_oklch(0.7_0.17_45/0.5)]" />
        {cells.map((day, index) => (
          <span
            key={day.key}
            title={day.title}
            onMouseEnter={() => setHovered(index)}
            className={`absolute top-1/2 left-1/2 -mt-3 -ml-1.25 w-2.5 cursor-pointer rounded-md transition-[height] duration-200 ${
              day.streak ? 'bg-grad' : FILL[day.level]
            }`}
            style={{
              height: hovered === index ? 36 : HEIGHT[day.level],
              transformOrigin: '50% 12px',
              transform: `rotate(${(index * 360) / cells.length}deg) translateY(-100px)`,
              animation: `vy-up 400ms ${index * 18}ms both`
            }}
          />
        ))}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-[#2a0f1a]"
        >
          <span className="max-w-24 text-center font-display text-[2.5rem] leading-none font-extrabold">
            {cell ? '' : big}
          </span>
          <span className="max-w-24 px-1 text-center text-xs leading-tight font-bold">
            {cell ? cell.title : unit}
          </span>
        </div>
      </div>
      <ul className="sr-only">
        {cells
          .filter((day) => day.level > 0)
          .map((day) => (
            <li key={day.key}>{day.title}</li>
          ))}
      </ul>
    </div>
  )
}
