import { t, type MessageKey } from '@renderer/i18n'
import type { LiveLine } from '../liveProgress'

// A posture that is kept: how long the person has held it now, against the time that counts, and
// how the session goes. It is read from a distance, so the seconds are the largest thing on it.
export function HoldTimer({
  heldMs,
  goalMs,
  count,
  label,
  lines
}: {
  // Time in position without a break; null while the person is out of it.
  heldMs: number | null
  // The time that makes the posture count.
  goalMs: number
  // Postures held so far, and what they are called.
  count: number
  label: MessageKey
  lines: readonly LiveLine[]
}): React.JSX.Element {
  const seconds = Math.floor((heldMs ?? 0) / 1000)
  const goal = Math.round(goalMs / 1000)
  const reached = heldMs !== null && heldMs >= goalMs
  const share = heldMs === null ? 0 : Math.min(1, heldMs / goalMs)
  // One segment for each second to hold, never fewer than two nor more than eight.
  const segments = Math.min(8, Math.max(2, goal))

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-lg text-t4" aria-live="polite">
        {heldMs === null ? t('hold.away') : t(reached ? 'hold.reached' : 'hold.keep')}
      </p>
      <p className="font-display text-[6rem] leading-none font-bold tabular-nums">
        {seconds}
        <span className="ml-1 text-3xl text-t4">s</span>
      </p>
      <div
        className="flex w-56 gap-1"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
        aria-label={t('hold.progress', { seconds, goal })}
      >
        {Array.from({ length: segments }, (_, index) => (
          <span key={index} className="h-2.5 flex-1 overflow-hidden rounded-[5px] bg-line/12">
            <span
              className="block h-full rounded-[5px] bg-grad transition-[width] duration-150 ease-linear"
              style={{
                width: `${Math.min(1, Math.max(0, ((heldMs ?? 0) / 1000 - index) / (goalMs / 1000 / segments))) * 100}%`
              }}
            />
          </span>
        ))}
      </div>
      <p className="text-sm text-t4 tabular-nums">{t('hold.progress', { seconds, goal })}</p>
      <p className="mt-1 text-base text-t3 tabular-nums">
        {count} {t(label)}
      </p>
      {lines.length > 0 && (
        <ul className="flex flex-col items-center gap-0.5 text-sm text-t4 tabular-nums">
          {lines.map((line) => (
            <li key={line.key}>{t(line.key, line.params)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
