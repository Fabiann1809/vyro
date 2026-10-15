import { useEffect, useRef } from 'react'
import { drawSkeleton } from '@renderer/core/skeleton'
import { LandmarkSmoother } from '@renderer/core/smoothing'
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const smootherRef = useRef(new LandmarkSmoother())

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  // The canvas keeps the video's own resolution; CSS scales both to the same box.
  usePoseDetection(videoRef, pose.pose?.landmarker ?? null, status === 'ready', (frame) => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!video || !canvas || !ctx || !video.videoWidth) return

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }
    const landmarks = smootherRef.current.smooth(frame.landmarks, frame.timestampMs)
    drawSkeleton(ctx, landmarks, canvas.width, canvas.height)
  })

  // A stale skeleton must not stay on screen when the camera stops or changes.
  useEffect(() => {
    if (status === 'ready') return
    smootherRef.current.reset()
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }, [status])

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
      <div className="relative w-fit">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="block max-h-[70vh] rounded-lg bg-black"
        />
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>
      <p role="status" className="text-sm text-slate-400">
        {pose.status === 'loading' && t('pose.loading')}
        {pose.status === 'ready' && t('pose.ready', { delegate: pose.delegate ?? '' })}
        {pose.status === 'error' && t('pose.error')}
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
