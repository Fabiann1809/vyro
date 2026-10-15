import { useEffect, useRef } from 'react'
import { cameraSettingsUrl } from '@shared/camera'
import { t } from '@renderer/i18n'
import { CameraProblem } from './CameraProblem'
import { useCamera } from './useCamera'

export function CameraPreview(): React.JSX.Element {
  const { status, stream, devices, activeDeviceId, errorKind, selectDevice, retry } = useCamera()
  const videoRef = useRef<HTMLVideoElement>(null)

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
