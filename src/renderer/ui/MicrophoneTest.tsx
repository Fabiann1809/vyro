import { useState } from 'react'
import { t, type MessageKey } from '@renderer/i18n'
import type { CameraErrorKind } from '@renderer/core/camera'
import { LevelMeter } from './LevelMeter'
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
      {status === 'listening' && <LevelMeter levelDb={levelDb} />}
      {status === 'error' && errorKind && <p role="alert">{t(ERROR_TEXT[errorKind])}</p>}
    </div>
  )
}
