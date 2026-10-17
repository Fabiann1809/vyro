import { useEffect, useRef } from 'react'
import type { PoseFrame } from '@renderer/core/detectionLoop'
import type { Landmark } from '@renderer/core/landmarks'
import { drawHands, drawObjectBox, drawSkeleton } from '@renderer/core/skeleton'
import { LandmarkSmoother } from '@renderer/core/smoothing'
import { t } from '@renderer/i18n'
import { cameraSettingsUrl } from '@shared/camera'
import { CameraProblem } from './CameraProblem'
import { useCamera } from './useCamera'
import { usePoseDetection } from './usePoseDetection'
import { useHandLandmarker } from './useHandLandmarker'
import { useObjectDetector } from './useObjectDetector'
import { usePoseLandmarker } from './usePoseLandmarker'

interface Props {
  // Called for every processed frame with the smoothed landmarks (null when nobody is in view).
  onFrame?: (frame: PoseFrame, landmarks: Landmark[] | null, video: HTMLVideoElement) => void
  // Elements drawn over the video, such as a framing guide.
  children?: React.ReactNode
  showDevicePicker?: boolean
  // Look for hands too, which loads the hand model.
  withHands?: boolean
  // Look for the object too, which loads the object model.
  withObjects?: boolean
  videoClassName?: string
}

// The camera picture with the skeleton over it, for the screens where the user is tracked.
export function CameraStage({
  onFrame,
  children,
  showDevicePicker,
  withHands = false,
  withObjects = false,
  videoClassName = 'max-h-[65vh] rounded-lg'
}: Props): React.JSX.Element {
  const { status, stream, devices, activeDeviceId, errorKind, selectDevice, retry } = useCamera()
  const pose = usePoseLandmarker()
  const hands = useHandLandmarker(withHands)
  const objects = useObjectDetector(withObjects)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const smootherRef = useRef(new LandmarkSmoother())

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  usePoseDetection(
    videoRef,
    pose.pose?.landmarker ?? null,
    status === 'ready',
    (frame) => {
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
      if (frame.hands) drawHands(ctx, frame.hands.observations, canvas.width, canvas.height)
      if (frame.objects) drawObjectBox(ctx, frame.objects.box, canvas.width, canvas.height)
      onFrame?.(frame, landmarks, video)
    },
    hands.hands?.landmarker ?? null,
    objects.objects?.detector ?? null
  )

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
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-fit">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`block bg-black ${videoClassName}`}
        />
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        {children}
      </div>
      <p role="status" className="text-sm text-mut">
        {status === 'starting' && t('camera.starting')}
        {status === 'ready' &&
          (pose.status === 'loading' ||
            hands.status === 'loading' ||
            objects.status === 'loading') &&
          t('pose.loading')}
        {(pose.status === 'error' || hands.status === 'error' || objects.status === 'error') &&
          t('pose.error')}
      </p>
      {showDevicePicker && devices.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          {t('camera.choose')}
          <select
            value={activeDeviceId ?? ''}
            onChange={(event) => selectDevice(event.target.value)}
            className="rounded-xl border border-line/12 bg-card px-3 py-2"
          >
            {devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || t('camera.fallbackName', { n: index + 1 })}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
