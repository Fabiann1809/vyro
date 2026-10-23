import { t, type MessageKey } from '@renderer/i18n'
import type { LiveLine } from '../liveProgress'

// The attempts so far, as large as the room allows: it is read from two or three metres away. The
// number is drawn again each time it changes so that it jumps a little, which says "counted". Under
// it, in small print, how the session is going in the terms the skill chose.
export function RepCounter({
  count,
  label,
  lines
}: {
  count: number
  label: MessageKey
  lines: readonly LiveLine[]
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center">
      <p
        key={count}
        aria-live="polite"
        className="font-display text-[8.5rem] leading-none font-bold tabular-nums"
        style={{ animation: 'vy-beat 300ms ease-out both' }}
      >
        {count}
      </p>
      <p className="mt-2 text-lg text-t4">{t(label)}</p>
      {lines.length > 0 && (
        <ul className="mt-2 flex flex-col items-center gap-0.5 text-sm text-t4 tabular-nums">
          {lines.map((line) => (
            <li key={line.key}>{t(line.key, line.params)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
