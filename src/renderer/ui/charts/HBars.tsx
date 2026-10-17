import { share } from './geometry'

export interface HBarRow {
  key: string
  label: string
  // The text at the right of the label: "14 times".
  value: string
  count: number
  // How it changed, in words: "3 fewer". Tone says whether that is good news.
  change?: { text: string; tone: 'better' | 'worse' | 'same' }
  // A mark in front of the label, so rows of different kinds can be told apart.
  mark?: React.ReactNode
  // The class of the bar; the channel's colour for example.
  fill: string
}

const TONE: Record<'better' | 'worse' | 'same', string> = {
  better: 'text-good-text',
  worse: 'text-bad-text',
  same: 'text-mut'
}

// Horizontal bars, longest first: for what happens most often.
export function HBars({ rows }: { rows: readonly HBarRow[] }): React.JSX.Element {
  const most = Math.max(1, ...rows.map((row) => row.count))

  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              {row.mark}
              {row.label}
            </span>
            <span className="shrink-0 whitespace-nowrap text-mut">{row.value}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/6">
              <div
                className={`h-full rounded-full transition-[width] duration-700 ${row.fill}`}
                style={{ width: `${share(row.count, most) * 100}%` }}
              />
            </div>
            {row.change && (
              <span className={`w-20 text-right text-xs ${TONE[row.change.tone]}`}>
                {row.change.text}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
