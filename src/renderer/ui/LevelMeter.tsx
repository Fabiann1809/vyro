import { meterFraction } from '@renderer/core/audio/level'
import { t } from '@renderer/i18n'

// How loud the microphone hears, as a bar and as a number: never colour alone.
export function LevelMeter({ levelDb }: { levelDb: number }): React.JSX.Element {
  const percent = Math.round(meterFraction(levelDb) * 100)
  const text = t('microphone.test.dbValue', { db: Math.round(levelDb) })

  return (
    <div className="flex items-center gap-3">
      <div
        role="meter"
        aria-label={t('microphone.test.level')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={text}
        className="h-3 w-64 overflow-hidden rounded bg-slate-300 dark:bg-slate-700"
      >
        <div className="h-full bg-emerald-600" style={{ width: `${percent}%` }} />
      </div>
      <span aria-hidden="true" className="font-mono text-sm">
        {text}
      </span>
    </div>
  )
}
