import { t } from '@renderer/i18n'
import { ringDash } from './geometry'
import { useCountUp } from './useCountUp'

const RADIUS = 78

// The score of a session as a ring that fills while the number counts up. A burst at the end
// marks that it arrived.
export function Ring({
  percent,
  summary
}: {
  percent: number
  summary: string
}): React.JSX.Element {
  const shown = useCountUp(percent)
  const { length, offset } = ringDash(RADIUS, shown)

  return (
    <div role="img" aria-label={summary} className="relative size-50">
      <span
        aria-hidden="true"
        className="absolute inset-2.5 rounded-full border-2 border-accent"
        style={{ animation: 'vy-burst 900ms ease-out 1250ms both' }}
      />
      <svg
        viewBox="0 0 180 180"
        aria-hidden="true"
        className="size-50 -rotate-90 drop-shadow-[0_0_14px_oklch(0.72_0.18_45/0.6)]"
      >
        <defs>
          <linearGradient id="vy-score-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFD1A0" />
            <stop offset="0.5" stopColor="#F27A3E" />
            <stop offset="1" stopColor="#A8326A" />
          </linearGradient>
        </defs>
        <circle cx={90} cy={90} r={RADIUS} className="fill-none stroke-line/8" strokeWidth={12} />
        <circle
          cx={90}
          cy={90}
          r={RADIUS}
          stroke="url(#vy-score-ring)"
          className="fill-none"
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={offset}
        />
      </svg>
      <div
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center"
      >
        <span className="font-display text-[3.5rem] leading-none font-semibold">{shown}</span>
        <span className="mt-1 text-[0.8125rem] text-mut">{t('chart.outOf100')}</span>
      </div>
    </div>
  )
}
