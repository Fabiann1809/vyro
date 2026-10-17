import { useState } from 'react'
import { t, type MessageKey } from '@renderer/i18n'
import type { CameraErrorKind } from '@renderer/core/camera'
import { Button } from './kit/Button'
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
    <div className="flex flex-col gap-3">
      <Button variant="secondary" className="self-start" onClick={() => setTesting((on) => !on)}>
        {t(testing ? 'microphone.test.stop' : 'microphone.test.start')}
      </Button>
      {status === 'starting' && (
        <p role="status" className="text-sm text-mut">
          {t('microphone.test.starting')}
        </p>
      )}
      {status === 'listening' && <LevelMeter levelDb={levelDb} />}
      {status === 'error' && errorKind && (
        <p role="alert" className="text-sm text-bad-text">
          {t(ERROR_TEXT[errorKind])}
        </p>
      )}
    </div>
  )
}
