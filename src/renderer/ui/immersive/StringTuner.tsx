import { t, type MessageKey } from '@renderer/i18n'
import type { Note } from '@renderer/core/audio/pitch'
import { IN_TUNE_CENTS, tuningStatus, type TuningStatus } from '@renderer/core/audio/tuning'
import { angleOf, arcPath, pointAt, tickPath } from '../charts/arc'
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

// The dial goes from 50 cents flat to 50 cents sharp.
const SCALE = { min: -50, max: 50 }
const CENTRE = { x: 300, y: 290 }
const RADIUS = 260
const GOOD = 'oklch(0.8 0.15 150)'

// The colour of the needle: green in tune, amber when near, rose when far.
function needleColour(status: TuningStatus): string {
  if (status === 'inTune') return GOOD
  if (status === 'flat' || status === 'sharp') return 'oklch(0.83 0.14 75)'
  return 'var(--mut)'
}

function Dial({
  cents,
  status
}: {
  cents: number | null
  status: TuningStatus
}): React.JSX.Element {
  const angle = angleOf(Math.max(-50, Math.min(50, cents ?? 0)), SCALE)
  const colour = needleColour(status)
  const soft = [angleOf(-25, SCALE), angleOf(25, SCALE)] as const
  const hard = [angleOf(-IN_TUNE_CENTS, SCALE), angleOf(IN_TUNE_CENTS, SCALE)] as const

  return (
    <svg viewBox="0 0 600 310" aria-hidden="true" className="h-full max-w-full overflow-visible">
      <path
        d={arcPath(CENTRE.x, CENTRE.y, RADIUS, 180, 0)}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.08"
        strokeWidth="26"
        strokeLinecap="round"
      />
      <path
        d={arcPath(CENTRE.x, CENTRE.y, RADIUS, soft[0], soft[1])}
        fill="none"
        stroke={GOOD}
        strokeOpacity="0.2"
        strokeWidth="26"
      />
      <path
        d={arcPath(CENTRE.x, CENTRE.y, RADIUS, hard[0], hard[1])}
        fill="none"
        stroke={GOOD}
        strokeOpacity="0.75"
        strokeWidth="26"
      />
      <path
        d={tickPath(CENTRE.x, CENTRE.y, RADIUS - 36, RADIUS - 26, 21)}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g
        style={{
          transformOrigin: `${CENTRE.x}px ${CENTRE.y}px`,
          transform: `rotate(${-angle}deg)`,
          transition: 'transform 160ms ease-out'
        }}
      >
        <path
          d={`M${CENTRE.x + 120} ${CENTRE.y}L${CENTRE.x + RADIUS - 20} ${CENTRE.y}`}
          stroke={colour}
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.25"
        />
        <path
          d={`M${CENTRE.x + 120} ${CENTRE.y}L${CENTRE.x + RADIUS - 20} ${CENTRE.y}`}
          stroke="#fff6ee"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
      <circle
        cx={CENTRE.x}
        cy={CENTRE.y}
        r="16"
        fill={colour}
        stroke="#0e080b"
        strokeWidth="6"
        style={{ transition: 'fill 200ms' }}
      />
      {[-50, 0, 50].map((mark) => {
        const [x, y] = pointAt(CENTRE.x, CENTRE.y, RADIUS + 34, angleOf(mark, SCALE))
        return (
          <text key={mark} x={x} y={y + 4} textAnchor="middle" className="fill-mut2 text-[13px]">
            {mark > 0 ? `+${mark}` : mark}
          </text>
        )
      })}
    </svg>
  )
}

// Tuning the strings one by one: which one is being tuned, what is heard, which way to turn the peg
// on a dial, and which strings are done. The person picks the string; it moves on by itself when one
// is in tune.
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
  const colour = needleColour(status)

  return (
    <div className="absolute inset-0 flex flex-col gap-2 px-8 pt-6 pb-5">
      <div className="flex shrink-0 items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-5">
          <span
            aria-hidden="true"
            className="flex size-28 shrink-0 items-center justify-center rounded-full text-[#1a0f0c]"
            style={{
              background:
                'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.6), var(--ch-audio) 60%)',
              boxShadow: `0 0 46px color-mix(in oklab, ${status === 'inTune' ? GOOD : 'var(--ch-audio)'} 50%, transparent)`,
              transition: 'box-shadow 300ms'
            }}
          >
            <span className="font-display text-[3rem] leading-none font-extrabold">{name}</span>
            <span className="-mt-7 font-display text-[1.375rem] font-bold">{octave}</span>
          </span>
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-semibold text-mut">{t('tuner.target')}</p>
            <p
              role="status"
              aria-live="polite"
              className="mt-1 flex items-center gap-2.5 text-[1.375rem] leading-tight font-bold text-balance"
              style={{ color: status === 'inTune' || allDone ? GOOD : undefined }}
            >
              <span aria-hidden="true">{allDone ? '✓' : STATUS_SYMBOL[status]}</span>
              {allDone
                ? t('tuner.allDone')
                : t(STATUS_TEXT[status], {
                    note: spoken(target),
                    heard: heard ? spoken(heard.name) : ''
                  })}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-[1.375rem] border border-line/10 bg-line/5 py-3 pr-4.5 pl-3.5">
          <span aria-hidden="true" className="flex h-5.5 items-center gap-0.75">
            {[10, 20, 14].map((height, bar) => (
              <span
                key={bar}
                className="w-0.75 rounded-xs bg-ch-audio"
                style={{ height, animation: `vy-dot 0.9s ${bar * 0.15}s infinite` }}
              />
            ))}
          </span>
          <div>
            <p className="text-xs text-mut">{t('tuner.heard')}</p>
            <p className="text-base font-bold whitespace-nowrap">
              {heard ? spoken(heard.name) : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex min-h-40 flex-1 justify-center">
        <Dial cents={cents} status={status} />
        <p
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-6 text-center"
        >
          <span
            className="block font-display text-[2.875rem] leading-none font-extrabold tabular-nums"
            style={{ color: colour, transition: 'color 200ms' }}
          >
            {cents === null ? '—' : `${shown > 0 ? '+' : ''}${shown}`}
          </span>
          <span className="mt-1 block text-[0.8125rem] text-mut">cents</span>
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-140 shrink-0 items-center gap-3.5">
        <span className="text-[0.8125rem] whitespace-nowrap text-mut">
          {t('tuner.status.inTune')}
        </span>
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-md bg-line/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(holdProgress * 100)}
          aria-label={t('tuner.status.inTune')}
        >
          <div
            className="h-full rounded-md shadow-[0_0_14px_oklch(0.8_0.15_150/0.7)] transition-[width] duration-150 ease-linear"
            style={{ width: `${holdProgress * 100}%`, background: GOOD }}
          />
        </div>
      </div>

      <div className="shrink-0">
        <p className="sr-only">
          {t('tuner.pickString')} · {t('tuner.order')}
        </p>
        <ul className="grid grid-cols-6 gap-2.5">
          {targets.map((string, position) => {
            const label = noteLabel(string)
            const done = tuned.has(position)
            const current = position === index
            return (
              <li key={`${string}-${position}`}>
                <button
                  type="button"
                  aria-pressed={current}
                  aria-label={`${spoken(string)}, ${t(done ? 'tuner.tuned' : 'tuner.pending')}`}
                  onClick={() => onPick(position)}
                  className={`flex h-26 w-full flex-col items-center justify-between rounded-3xl border px-1.5 pt-3 pb-2.5 transition duration-300 hover:-translate-y-0.5 ${
                    current
                      ? 'border-brand/60 bg-brand/15'
                      : done
                        ? 'border-good/40 bg-good/10'
                        : 'border-line/10 bg-line/5'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-9 rounded-xs ${current ? 'bg-t1 shadow-[0_0_10px_var(--t1)]' : done ? 'bg-good' : 'bg-mut3'}`}
                    style={{
                      width: 2 + (targets.length - position) * 0.6,
                      animation: current ? 'vy-vib 0.12s infinite' : undefined
                    }}
                  />
                  <span className="font-display text-[1.0625rem] font-bold whitespace-nowrap">
                    {label.name}
                    <span className="ml-0.5 text-[0.8rem] text-mut">{label.octave}</span>
                  </span>
                  <span
                    className={`text-[0.72rem] font-extrabold whitespace-nowrap ${done ? 'text-good-text' : 'text-mut'}`}
                  >
                    <span aria-hidden="true">{done ? '✓ ' : ''}</span>
                    {t(done ? 'tuner.tuned' : 'tuner.pending')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-2.5 text-center text-sm font-semibold text-t2">
          {t('tuner.count', { done: tuned.size, total: targets.length })}
        </p>
      </div>
    </div>
  )
}
