import { useCallback, useEffect, useState } from 'react'
import { listVideoInputs, openCamera, stopStream, type CameraDevice } from '@renderer/core/camera'

export type CameraStatus = 'starting' | 'ready' | 'error'

export interface CameraState {
  status: CameraStatus
  stream: MediaStream | null
  devices: CameraDevice[]
  activeDeviceId: string | undefined
  errorName: string | undefined
  selectDevice: (deviceId: string) => void
}

export function useCamera(): CameraState {
  const [requestedId, setRequestedId] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [errorName, setErrorName] = useState<string | undefined>(undefined)

  const refreshDevices = useCallback(async () => {
    setDevices(await listVideoInputs(navigator.mediaDevices))
  }, [])

  useEffect(() => {
    let cancelled = false
    let opened: MediaStream | null = null

    openCamera(navigator.mediaDevices, requestedId)
      .then(async (next) => {
        if (cancelled) return stopStream(next)
        opened = next
        setStream(next)
        setErrorName(undefined)
        setStatus('ready')
        await refreshDevices()
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setStream(null)
        setErrorName(error instanceof Error ? error.name : 'UnknownError')
        setStatus('error')
      })

    return () => {
      cancelled = true
      if (opened) stopStream(opened)
    }
  }, [requestedId, refreshDevices])

  // Plugging or unplugging a camera (for example a phone webcam) updates the list.
  useEffect(() => {
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
  }, [refreshDevices])

  const selectDevice = useCallback((deviceId: string) => {
    setStatus('starting')
    setRequestedId(deviceId)
  }, [])

  const activeDeviceId = stream?.getVideoTracks()[0]?.getSettings().deviceId

  return { status, stream, devices, activeDeviceId, errorName, selectDevice }
}
