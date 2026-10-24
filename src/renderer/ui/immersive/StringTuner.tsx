import { t, type MessageKey } from '@renderer/i18n'
import type { Note } from '@renderer/core/audio/pitch'
import { IN_TUNE_CENTS, tuningStatus, type TuningStatus } from '@renderer/core/audio/tuning'
import { NeedleMeter } from '../charts/NeedleMeter'
import { noteLabel } from '../noteLabel'

const STATUS_TEXT: Record<TuningStatus, MessageKey> = {
  silent: 'tuner.status.silent',
  flat: 'tuner.status.flat',
  sharp: 'tuner.status.sharp',
  inTune: 'tuner.status.inTune',
  otherString: 'tuner.status.otherString'
}

// Never colour alone: each state has a symbol and words as well.
const STATUS_SYMBOL: Record<TuningStatus, string> = {
  silent: '♪',
  flat: '↑',
  sharp: '↓',
  inTune: '✓',
  otherString: '?'
}

const spoken = (note: string): string => {
  const { name, octave } = noteLabel(note)
  return `${name} ${octave}`.trim()
}

// Tuning the strings one by one: which one is being tuned, what is heard, which way to turn the peg,
// and which strings are done. The person picks the string; it moves on by itself when one is in tune.
export function StringTuner({
  targets,
  index,
  tuned,
  heard,
  cents,
  holdProgress,
  onPick
}: {
  // The notes of the strings, lowest first.
  targets: readonly string[]
  // The string being tuned.
  index: number
  tuned: ReadonlySet<number>
  // The note that sounds; null when there is no clear pitch.
  heard: Note | null
  // How far the sound is from the string being tuned; null when there is no clear pitch.
  cents: number | null
  // How much of the time in tune has gone by, 0..1.
  holdProgress: number
  onPick: (index: number) => void
}): React.JSX.Element {
  const target = targets[index] ?? ''
  const { name, octave } = noteLabel(target)
  const status = tuningStatus(cents)
  const allDone = tuned.size === targets.length
  const shown = Math.round(cents ?? 0)

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-5 p-6">
      <div className="text-center">
        <p className="text-lg text-t4">{t('tuner.target')}</p>
        <p className="font-display text-[7rem] leading-none font-bold">
          {name}
          <span className="ml-1 text-5xl text-t4">{octave}</span>
        </p>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={`flex min-h-16 items-center gap-3 text-center text-2xl font-semibold ${status === 'inTune' ? 'text-accent' : ''}`}
      >
        <span aria-hidden="true">{allDone ? '✓' : STATUS_SYMBOL[status]}</span>
        {allDone
          ? t('tuner.allDone')
          : t(STATUS_TEXT[status], {
              note: spoken(target),
              heard: heard ? spoken(heard.name) : ''
            })}
      </p>

      <div className="w-full">
        <NeedleMeter cents={shown} zone={IN_TUNE_CENTS} tall />
        <div className="mt-2 flex items-baseline justify-between text-sm text-t4 tabular-nums">
          <span>
            {t('tuner.heard')}: {heard ? spoken(heard.name) : '—'}
          </span>
          <span>
            {cents === null
              ? ''
              : t('training.tuner.cents', { cents: `${shown > 0 ? '+' : ''}${shown}` })}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(holdProgress * 100)}
          aria-label={t('tuner.status.inTune')}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-100"
            style={{ width: `${holdProgress * 100}%` }}
          />
        </div>
      </div>

      <div className="w-full">
        <p className="mb-2 text-center text-sm text-t4">
          {t('tuner.pickString')} · {t('tuner.order')}
        </p>
        <ul className="flex flex-wrap justify-center gap-2">
          {targets.map((string, position) => {
            const label = noteLabel(string)
            const done = tuned.has(position)
            return (
              <li key={`${string}-${position}`}>
                <button
                  type="button"
                  aria-pressed={position === index}
                  aria-label={`${spoken(string)}, ${t(done ? 'tuner.tuned' : 'tuner.pending')}`}
                  onClick={() => onPick(position)}
                  className={`flex min-w-24 flex-col items-center rounded-2xl border px-4 py-2.5 text-lg font-semibold transition-colors ${
                    position === index
                      ? 'border-brand bg-brand/15 text-t1'
                      : 'border-line/10 bg-card text-t3 hover:bg-card2'
                  }`}
                >
                  <span>
                    {label.name}
                    <span className="ml-0.5 text-sm text-t4">{label.octave}</span>
                  </span>
                  <span className="text-xs font-normal text-t4">
                    <span aria-hidden="true">{done ? '✓ ' : ''}</span>
                    {done ? t('tuner.tuned') : t('tuner.pending')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-center text-sm text-t4">
          {t('tuner.count', { done: tuned.size, total: targets.length })}
        </p>
      </div>
    </div>
  )
}
