import { useEffect, useRef } from 'react'
import { useCamera } from './useCamera'

export function CameraPreview(): React.JSX.Element {
  const { stream, devices, activeDeviceId, selectDevice } = useCamera()
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  return (
    <div className="flex flex-col items-center gap-4">
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
            {device.label || `#${index + 1}`}
          </option>
        ))}
      </select>
    </div>
  )
}
