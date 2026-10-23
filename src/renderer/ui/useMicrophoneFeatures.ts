import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioFeatures, FeatureExtractor } from '@renderer/core/audio/capture'
import { loadInstrumentListener } from '@renderer/core/audio/instrumentModel'
import { classifyCameraError, type CameraErrorKind } from '@renderer/core/camera'
import type { MessageKey } from '@renderer/i18n'
import { listenToMicrophone } from './microphone'
import { useSettings } from './settingsStore'

export type MicrophoneStatus = 'off' | 'starting' | 'listening' | 'error'

const ERROR_TEXT: Record<CameraErrorKind, MessageKey> = {
  'permission-denied': 'microphone.error.permissionDenied',
  'no-device': 'microphone.error.noDevice',
  'in-use': 'microphone.error.inUse',
  unknown: 'microphone.error.unknown'
}

export interface MicrophoneFeatures {
  status: MicrophoneStatus
  errorMessage: MessageKey | undefined
  retry: () => void
}

// Listens to the microphone while `active` and hands the numbers about the sound to `onFeatures`.
// The microphone is opened only now, and let go of when this stops being active.
export function useMicrophoneFeatures(
  active: boolean,
  onFeatures: (features: AudioFeatures) => void,
  // What to measure in the sound; only how loud it is, unless asked for more.
  extract?: FeatureExtractor,
  // Also tell which instrument is playing. If the model cannot be loaded the sound is still measured,
  // only without the instrument.
  classify = false
): MicrophoneFeatures {
  const [failure, setFailure] = useState<CameraErrorKind | null>(null)
  const [heard, setHeard] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // The listener keeps running when the caller passes a new function on every render.
  const callback = useRef(onFeatures)
  useEffect(() => {
    callback.current = onFeatures
  })

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let close: (() => void) | undefined

    const listener = classify
      ? loadInstrumentListener().catch(() => undefined)
      : Promise.resolve(undefined)

    listener
      .then((instruments) =>
        listenToMicrophone(
          window.api,
          (features) => {
            if (cancelled) return
            setHeard(true)
            callback.current(features)
          },
          {
            deviceId: useSettings.getState().audioDeviceId ?? undefined,
            extract,
            listener: instruments
          }
        )
      )
      .then((listening) => {
        if (cancelled) listening.close()
        else close = listening.close
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(classifyCameraError(error))
      })

    return () => {
      cancelled = true
      close?.()
      setHeard(false)
      setFailure(null)
    }
  }, [active, attempt, extract, classify])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  const status: MicrophoneStatus = !active
    ? 'off'
    : failure
      ? 'error'
      : heard
        ? 'listening'
        : 'starting'
  return { status, errorMessage: failure ? ERROR_TEXT[failure] : undefined, retry }
}
