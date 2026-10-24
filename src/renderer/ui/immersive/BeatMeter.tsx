import { t, type MessageKey } from '@renderer/i18n'
import { beatOffset, beatStatus, STEADY_SHARE, type BeatStatus } from '@renderer/core/audio/beat'
import { Card } from '../kit/Card'

const STATUS_TEXT: Record<BeatStatus, MessageKey> = {
  silent: 'beat.status.silent',
  slow: 'beat.status.slow',
  steady: 'beat.status.steady',
  fast: 'beat.status.fast'
}

// Never colour alone: each state has a symbol and words as well.
const STATUS_SYMBOL: Record<BeatStatus, string> = {
  silent: '♪',
  slow: '↑',
  steady: '✓',
  fast: '↓'
}

// The needle moves over -50 % to +50 % of the pace asked for.
const SCALE = 0.5

// A steady pulse: the pace asked for, with a dot that beats at that pace to follow, the pace heard,
// and whether it is slow, steady or fast.
export function BeatMeter({
  bpm,
  targetBpm
}: {
  // The pace of the last notes; null until a few have been struck.
  bpm: number | null
  targetBpm: number
}): React.JSX.Element {
  const status = beatStatus(bpm, targetBpm)
  const left = bpm === null ? 50 : 50 + (beatOffset(bpm, targetBpm) / SCALE) * 50
  const zone = (STEADY_SHARE / SCALE) * 50

  return (
    <Card className="flex flex-col items-center gap-3 p-5 text-center">
      <p className="text-[0.8125rem] text-mut">{t('beat.target', { bpm: targetBpm })}</p>
      <span
        aria-hidden="true"
        className="size-20 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.6),var(--ch-audio)_60%)] shadow-[0_0_40px_color-mix(in_oklab,var(--ch-audio)_50%,transparent)]"
        style={{ animation: `vy-pulse ${60_000 / targetBpm}ms ease-in-out infinite` }}
      />
      <p className="font-display text-7xl leading-none font-bold tabular-nums">
        {bpm === null ? '—' : Math.round(bpm)}
        <span className="ml-1 text-2xl text-t4">{t('beat.unit')}</span>
      </p>
      <div className="relative h-10 w-full overflow-hidden rounded-2xl bg-sunk" aria-hidden="true">
        <div
          className="absolute top-0 bottom-0 border-x border-dashed border-brand/50 bg-brand/14"
          style={{ left: `${50 - zone}%`, width: `${zone * 2}%` }}
        />
        <div
          className="absolute top-1 bottom-1 -ml-0.5 w-1 rounded bg-t1 transition-[left] duration-150 ease-out"
          style={{ left: `${left}%` }}
        />
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`flex min-h-14 items-center gap-2 text-lg font-semibold ${status === 'steady' ? 'text-accent' : ''}`}
      >
        <span aria-hidden="true">{STATUS_SYMBOL[status]}</span>
        {t(STATUS_TEXT[status])}
      </p>
    </Card>
  )
}
