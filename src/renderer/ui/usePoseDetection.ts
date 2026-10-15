import { useEffect, useRef, type RefObject } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { startDetectionLoop, type PoseFrame } from '@renderer/core/detectionLoop'

// Runs pose detection on every frame of the video while `active` is true.
export function usePoseDetection(
  videoRef: RefObject<HTMLVideoElement | null>,
  landmarker: PoseLandmarker | null,
  active: boolean,
  onFrame: (frame: PoseFrame) => void
): void {
  // Keeps the loop running when the caller passes a new callback on every render.
  const onFrameRef = useRef(onFrame)
  useEffect(() => {
    onFrameRef.current = onFrame
  })

  useEffect(() => {
    const video = videoRef.current
    if (!active || !video || !landmarker) return

    return startDetectionLoop(video, landmarker, {
      onFrame: (frame) => onFrameRef.current(frame),
      onError: (error) => console.error('Pose detection stopped', error)
    })
  }, [videoRef, landmarker, active])
}
