import { t, type MessageKey } from '@renderer/i18n'
import type { Note } from '@renderer/core/audio/pitch'
import { playedNoteStatus, type PlayedNote } from '@renderer/core/audio/tuning'
import { Card } from '../kit/Card'
import { noteLabel } from '../noteLabel'

const STATUS_TEXT: Record<PlayedNote, MessageKey> = {
  silent: 'target.status.silent',
  right: 'target.status.right',
  wrong: 'target.status.wrong'
}

// Never colour alone: each state has a symbol and words as well.
const STATUS_SYMBOL: Record<PlayedNote, string> = { silent: '♪', right: '✓', wrong: '✗' }

const spoken = (note: string): string => {
  const { name, octave } = noteLabel(note)
  return `${name} ${octave}`.trim()
}

// A note to play, such as a key of the piano: which one it is, what is heard, and whether it is the
// right one. How many were right so far is told under it.
export function TargetNote({
  target,
  heard,
  cents,
  good,
  judged
}: {
  target: string
  // The note that sounds; null when there is no clear pitch.
  heard: Note | null
  // How far the sound is from the target; null when there is no clear pitch.
  cents: number | null
  good: number
  judged: number
}): React.JSX.Element {
  const status = playedNoteStatus(cents)
  const { name, octave } = noteLabel(target)

  return (
    <Card className="flex flex-col items-center gap-3 p-5 text-center">
      <p className="text-[0.8125rem] text-mut">{t('target.play')}</p>
      <span
        aria-hidden="true"
        className="flex size-24 items-center justify-center rounded-full text-[#1a0f0c] transition-shadow duration-300"
        style={{
          background:
            'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.6), var(--ch-hands) 60%)',
          boxShadow: `0 0 36px color-mix(in oklab, ${status === 'right' ? 'var(--good)' : 'var(--ch-hands)'} 50%, transparent)`
        }}
      >
        <span className="font-display text-4xl font-extrabold">{name}</span>
        <span className="-mt-6 ml-0.5 font-display text-lg font-bold">{octave}</span>
      </span>
      <p className="sr-only">{spoken(target)}</p>
      <p
        role="status"
        aria-live="polite"
        className={`flex min-h-14 items-center gap-2 text-lg font-semibold ${status === 'right' ? 'text-accent' : ''}`}
      >
        <span aria-hidden="true">{STATUS_SYMBOL[status]}</span>
        {t(STATUS_TEXT[status], {
          note: spoken(target),
          heard: heard ? spoken(heard.name) : ''
        })}
      </p>
      {judged > 0 && <p className="text-sm text-t4">{t('target.count', { good, judged })}</p>}
    </Card>
  )
}
