import { useEffect, useState } from 'react'
import { classifyCameraError, type CameraErrorKind } from '@renderer/core/camera'
import { SILENCE_DB } from '@renderer/core/audio/level'
import { listenToMicrophone } from './microphone'
import { useSettings } from './settingsStore'

export type MicrophoneStatus = 'off' | 'starting' | 'listening' | 'error'

export interface MicrophoneLevel {
  status: MicrophoneStatus
  levelDb: number
  errorKind: CameraErrorKind | undefined
}

// The level of the microphone, live, while `active`. Nothing is kept: only the number.
export function useMicrophoneLevel(active: boolean): MicrophoneLevel {
  const [state, setState] = useState<MicrophoneLevel>({
    status: 'off',
    levelDb: SILENCE_DB,
    errorKind: undefined
  })

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let close: (() => void) | undefined

    listenToMicrophone(
      window.api,
      (features) => {
        if (!cancelled) {
          setState({ status: 'listening', levelDb: features.levelDb, errorKind: undefined })
        }
      },
      { deviceId: useSettings.getState().audioDeviceId ?? undefined }
    )
      .then((listening) => {
        if (cancelled) listening.close()
        else close = listening.close
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', levelDb: SILENCE_DB, errorKind: classifyCameraError(error) })
        }
      })

    return () => {
      cancelled = true
      close?.()
      setState({ status: 'off', levelDb: SILENCE_DB, errorKind: undefined })
    }
  }, [active])

  // Between asking for the microphone and hearing it there is a moment of waiting.
  if (active && state.status === 'off') return { ...state, status: 'starting' }
  return state
}
