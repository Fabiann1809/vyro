import { t } from '@renderer/i18n'
import { percentOn, type Range } from './geometry'

// How far a note is from the one aimed at, in cents. The green band in the middle is "in tune"; the
// needle moves around it. The number is also written, so that it never depends on the needle.
export function NeedleMeter({
  cents,
  range = { min: -50, max: 50 },
  zone = 25
}: {
  cents: number
  range?: Range
  // How many cents either side of the note still count as in tune.
  zone?: number
}): React.JSX.Element {
  const left = percentOn(cents, range)
  const zoneStart = percentOn(-zone, range)
  const zoneEnd = percentOn(zone, range)

  return (
    <div className="relative h-14.5 overflow-hidden rounded-2xl bg-sunk" aria-hidden="true">
      <div
        className="absolute top-0 bottom-0 border-x border-dashed border-brand/50 bg-brand/14"
        style={{ left: `${zoneStart}%`, width: `${zoneEnd - zoneStart}%` }}
      />
      <div className="absolute top-2 bottom-2 left-1/2 w-px bg-line/25" />
      <div
        className="absolute top-1 bottom-1 -ml-0.5 w-1 rounded bg-t1 shadow-[0_0_12px_rgba(255,255,255,0.4)] transition-[left] duration-150 ease-out"
        style={{ left: `${left}%` }}
      />
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[0.65rem] text-accent">
        {t('chart.inTune', { cents: zone })}
      </span>
    </div>
  )
}
