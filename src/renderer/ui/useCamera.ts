import { useCallback, useEffect, useState } from 'react'
import {
  classifyCameraError,
  listVideoInputs,
  openCamera,
  stopStream,
  type CameraDevice,
  type CameraErrorKind
} from '@renderer/core/camera'
import { useSettings } from './settingsStore'

export type CameraStatus = 'starting' | 'ready' | 'error'

export interface CameraState {
  status: CameraStatus
  stream: MediaStream | null
  devices: CameraDevice[]
  activeDeviceId: string | undefined
  errorKind: CameraErrorKind | undefined
  selectDevice: (deviceId: string) => void
  retry: () => void
}

// macOS tells us up front when the user already denied camera access.
async function isBlockedByOperatingSystem(): Promise<boolean> {
  const status = await window.api.camera.requestAccess()
  return status === 'denied' || status === 'restricted'
}

export function useCamera(): CameraState {
  const [requestedId, setRequestedId] = useState<string | undefined>(
    () => useSettings.getState().cameraId ?? undefined
  )
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [errorKind, setErrorKind] = useState<CameraErrorKind | undefined>(undefined)

  const refreshDevices = useCallback(async () => {
    setDevices(await listVideoInputs(navigator.mediaDevices))
  }, [])

  useEffect(() => {
    let cancelled = false
    let opened: MediaStream | null = null

    const fail = (kind: CameraErrorKind): void => {
      if (cancelled) return
      setStream(null)
      setErrorKind(kind)
      setStatus('error')
    }

    // A remembered camera may be unplugged by now: fall back to the default one.
    const openPreferredCamera = async (): Promise<MediaStream> => {
      try {
        return await openCamera(navigator.mediaDevices, requestedId)
      } catch (error) {
        if (requestedId && classifyCameraError(error) === 'no-device') {
          return openCamera(navigator.mediaDevices)
        }
        throw error
      }
    }

    const start = async (): Promise<void> => {
      if (await isBlockedByOperatingSystem()) return fail('permission-denied')

      const next = await openPreferredCamera()
      if (cancelled) return stopStream(next)

      opened = next
      next.getVideoTracks()[0]?.addEventListener('ended', () => fail('no-device'))
      setStream(next)
      setErrorKind(undefined)
      setStatus('ready')
      await refreshDevices()
    }

    start().catch((error: unknown) => fail(classifyCameraError(error)))

    return () => {
      cancelled = true
      if (opened) stopStream(opened)
    }
  }, [requestedId, attempt, refreshDevices])

  const retry = useCallback(() => {
    setStatus('starting')
    setAttempt((count) => count + 1)
  }, [])

  // Plugging in a camera (for example a phone webcam) updates the list and recovers from "no device".
  useEffect(() => {
    const onDeviceChange = (): void => {
      refreshDevices().catch(() => undefined)
      if (errorKind === 'no-device') retry()
    }
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange)
  }, [refreshDevices, errorKind, retry])

  const selectDevice = useCallback((deviceId: string) => {
    setStatus('starting')
    setRequestedId(deviceId)
    useSettings.getState().setCameraId(deviceId)
  }, [])

  const activeDeviceId = stream?.getVideoTracks()[0]?.getSettings().deviceId

  return { status, stream, devices, activeDeviceId, errorKind, selectDevice, retry }
}
