export type HeatLevel = 0 | 1 | 2 | 3

export interface HeatCell {
  key: string
  // What it says when pointed at: "17 oct · score 78".
  title: string
  level: HeatLevel
  // The days of the current streak get a ring.
  streak: boolean
}

const LEVEL: Record<HeatLevel, string> = {
  0: 'bg-empty',
  1: 'bg-good/30',
  2: 'bg-good/60',
  3: 'bg-good'
}

// A calendar of weeks, one square a day, the darker the better the day. Read down each column.
export function Heatmap({
  cells,
  summary
}: {
  cells: readonly HeatCell[]
  summary: string
}): React.JSX.Element {
  return (
    <div
      role="img"
      aria-label={summary}
      className="grid aspect-12/7 grid-flow-col grid-rows-7 gap-1"
    >
      {cells.map((cell) => (
        <div
          key={cell.key}
          title={cell.title}
          className={`rounded ${LEVEL[cell.level]} ${cell.streak ? 'shadow-[inset_0_0_0_1.5px_var(--t1)]' : ''}`}
        />
      ))}
    </div>
  )
}
