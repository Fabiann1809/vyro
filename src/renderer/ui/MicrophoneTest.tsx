import { useState } from 'react'
import { meterFraction } from '@renderer/core/audio/level'
import { t, type MessageKey } from '@renderer/i18n'
import type { CameraErrorKind } from '@renderer/core/camera'
import { useMicrophoneLevel } from './useMicrophoneLevel'

const ERROR_TEXT: Record<CameraErrorKind, MessageKey> = {
  'permission-denied': 'microphone.error.permissionDenied',
  'no-device': 'microphone.error.noDevice',
  'in-use': 'microphone.error.inUse',
  unknown: 'microphone.error.unknown'
}

// Lets the person hear how loud the microphone is hearing them, to choose the input. It listens only
// while it is switched on here, and nothing is recorded.
export function MicrophoneTest(): React.JSX.Element {
  const [testing, setTesting] = useState(false)
  const { status, levelDb, errorKind } = useMicrophoneLevel(testing)
  const percent = Math.round(meterFraction(levelDb) * 100)

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setTesting((on) => !on)}
        className="w-fit rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
      >
        {t(testing ? 'microphone.test.stop' : 'microphone.test.start')}
      </button>
      {status === 'starting' && <p role="status">{t('microphone.test.starting')}</p>}
      {status === 'listening' && (
        <div className="flex items-center gap-3">
          <div
            role="meter"
            aria-label={t('microphone.test.level')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={t('microphone.test.dbValue', { db: Math.round(levelDb) })}
            className="h-3 w-64 overflow-hidden rounded bg-slate-300 dark:bg-slate-700"
          >
            <div className="h-full bg-emerald-600" style={{ width: `${percent}%` }} />
          </div>
          <span aria-hidden="true" className="font-mono text-sm">
            {t('microphone.test.dbValue', { db: Math.round(levelDb) })}
          </span>
        </div>
      )}
      {status === 'error' && errorKind && <p role="alert">{t(ERROR_TEXT[errorKind])}</p>}
    </div>
  )
}
