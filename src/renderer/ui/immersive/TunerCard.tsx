import { t } from '@renderer/i18n'
import type { Note } from '@renderer/core/audio/pitch'
import { NeedleMeter } from '../charts/NeedleMeter'
import { Card } from '../kit/Card'
import { LevelMeter } from '../LevelMeter'

// What the microphone hears while practising a skill with sound: the note it is closest to, how far
// it is from it as a needle and as a number, and how loud it is.
export function TunerCard({
  note,
  levelDb
}: {
  // The note being heard; null when there is no clear pitch (silence, noise).
  note: Note | null
  levelDb: number
}): React.JSX.Element {
  const cents = note ? Math.round(note.cents) : 0

  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[0.8125rem] text-mut">{t('training.tuner.title')}</p>
        <p className="text-[0.9375rem] font-semibold tabular-nums">
          {note
            ? `${note.name} · ${t('training.tuner.cents', { cents: `${cents > 0 ? '+' : ''}${cents}` })}`
            : t('training.tuner.none')}
        </p>
      </div>
      <NeedleMeter cents={cents} />
      <LevelMeter levelDb={levelDb} />
    </Card>
  )
}
