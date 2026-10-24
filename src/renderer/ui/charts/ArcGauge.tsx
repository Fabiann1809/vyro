import { angleOf, arcPath, tickPath, type Scale } from './arc'

const CENTRE = { x: 140, y: 140 }
const RADIUS = 120

// A half circle gauge: the zone that is good is painted on the arc and a needle points at where the
// value is. The number is also written in the middle, so the needle is never the only way to read it.
export function ArcGauge({
  value,
  scale,
  zone,
  display,
  summary,
  minLabel,
  maxLabel,
  zoneLabel,
  colorClass
}: {
  value: number
  scale: Scale
  // The part of the scale that counts as good.
  zone: Scale
  // The value as it is written in the middle: "12 %".
  display: string
  // One sentence that says what the gauge shows, for screen readers.
  summary: string
  minLabel: string
  maxLabel: string
  zoneLabel: string
  // A text colour class for the needle and the number.
  colorClass: string
}): React.JSX.Element {
  const angle = angleOf(value, scale)
  const zoneFrom = angleOf(zone.min, scale)
  const zoneTo = angleOf(zone.max, scale)

  return (
    <div role="img" aria-label={summary} className="flex flex-col gap-1">
      <div className="relative">
        <svg viewBox="0 0 280 160" className="block h-auto w-full overflow-visible">
          <path
            d={arcPath(CENTRE.x, CENTRE.y, RADIUS, 180, 0)}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="18"
            strokeLinecap="round"
          />
          <path
            d={arcPath(CENTRE.x, CENTRE.y, RADIUS, zoneFrom, zoneTo)}
            fill="none"
            stroke="var(--good)"
            strokeOpacity="0.8"
            strokeWidth="18"
          />
          <path
            d={tickPath(CENTRE.x, CENTRE.y, RADIUS - 20, RADIUS - 13, 11)}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.3"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <g
            className={colorClass}
            style={{
              transformOrigin: `${CENTRE.x}px ${CENTRE.y}px`,
              transform: `rotate(${-angle}deg)`,
              transition: 'transform 1000ms cubic-bezier(0.3, 1.35, 0.45, 1)'
            }}
          >
            <path
              d={`M${CENTRE.x} ${CENTRE.y}L${CENTRE.x + RADIUS - 38} ${CENTRE.y}`}
              stroke="var(--t1)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle
              cx={CENTRE.x + RADIUS - 38}
              cy={CENTRE.y}
              r="6"
              fill="currentColor"
              stroke="var(--t1)"
              strokeWidth="2"
            />
          </g>
          <circle
            cx={CENTRE.x}
            cy={CENTRE.y}
            r="11"
            className={`${colorClass} fill-current`}
            stroke="var(--bg)"
            strokeWidth="4"
          />
        </svg>
        <p
          aria-hidden="true"
          className={`absolute inset-x-0 top-[44%] text-center font-display text-[2rem] leading-none font-bold ${colorClass}`}
        >
          {display}
        </p>
      </div>
      <div
        aria-hidden="true"
        className="-mt-1.5 flex justify-between text-[0.72rem] text-mut2 tabular-nums"
      >
        <span>{minLabel}</span>
        <span className="font-semibold text-good-text">{zoneLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  )
}
