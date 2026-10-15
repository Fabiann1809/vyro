import { useEffect, useRef, useState } from 'react'
import { cameraSettingsUrl } from '@shared/camera'
import { t } from '@renderer/i18n'
import { CameraProblem } from './CameraProblem'
import { useCamera } from './useCamera'
import { usePoseDetection } from './usePoseDetection'
import { usePoseLandmarker } from './usePoseLandmarker'

export function CameraPreview(): React.JSX.Element {
  const { status, stream, devices, activeDeviceId, errorKind, selectDevice, retry } = useCamera()
  const pose = usePoseLandmarker()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [landmarkCount, setLandmarkCount] = useState(0)
  const lastShownAt = useRef(0)

  // Temporary readout until the skeleton overlay replaces it. Updated 4 times a second at most.
  usePoseDetection(videoRef, pose.pose?.landmarker ?? null, status === 'ready', (frame) => {
    if (frame.timestampMs - lastShownAt.current < 250) return
    lastShownAt.current = frame.timestampMs
    setLandmarkCount(frame.landmarks?.length ?? 0)
  })

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  if (status === 'error' && errorKind) {
    return (
      <CameraProblem
        kind={errorKind}
        canOpenSettings={cameraSettingsUrl(window.api.platform) !== undefined}
        onRetry={retry}
        onOpenSettings={() => void window.api.camera.openSystemSettings()}
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {status === 'starting' && <p className="text-slate-300">{t('camera.starting')}</p>}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="max-h-[70vh] rounded-lg bg-black"
      />
      <p role="status" className="text-sm text-slate-400">
        {pose.status === 'loading' && t('pose.loading')}
        {pose.status === 'ready' && t('pose.ready', { delegate: pose.delegate ?? '' })}
        {pose.status === 'error' && t('pose.error')}
      </p>
      <p data-testid="landmark-count" className="text-sm text-slate-400">
        {t('pose.landmarks', { count: landmarkCount })}
      </p>
      <select
        value={activeDeviceId ?? ''}
        onChange={(event) => selectDevice(event.target.value)}
        className="rounded bg-slate-800 px-3 py-2 text-slate-100"
      >
        {devices.map((device, index) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || t('camera.fallbackName', { n: index + 1 })}
          </option>
        ))}
      </select>
    </div>
  )
}
