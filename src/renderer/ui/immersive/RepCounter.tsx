import { t } from '@renderer/i18n'

// The repetitions so far, as large as the room allows: it is read from two or three metres away. The
// number is drawn again each time it changes so that it jumps a little, which says "counted".
export function RepCounter({ count }: { count: number }): React.JSX.Element {
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
      <p className="mt-2 text-lg text-t4">{t('training.reps')}</p>
    </div>
  )
}
