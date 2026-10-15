import type { Landmark } from './landmarks'

export interface PoseFrame {
  timestampMs: number
  latencyMs: number
  // Null when nobody is in view.
  landmarks: Landmark[] | null
}

// The two small interfaces below are all the loop needs, so it can be tested without a camera.
export interface FrameSource {
  requestVideoFrameCallback: (callback: () => void) => number
  cancelVideoFrameCallback: (handle: number) => void
}

export interface PoseDetector<S> {
  detectForVideo: (source: S, timestampMs: number) => { landmarks: Landmark[][] }
}

export interface DetectionHandlers {
  onFrame: (frame: PoseFrame) => void
  onError: (error: unknown) => void
}

// Runs the detector once per video frame. The next frame is requested only after the current
// detection ends, so a slow machine drops frames instead of piling up work. Returns a stop function.
export function startDetectionLoop<S extends FrameSource>(
  source: S,
  detector: PoseDetector<S>,
  handlers: DetectionHandlers,
  clock: () => number = () => performance.now()
): () => void {
  let handle = 0
  let stopped = false
  let lastTimestamp = -1

  const onVideoFrame = (): void => {
    if (stopped) return

    try {
      const startedAt = clock()
      // The model requires strictly increasing timestamps.
      const timestampMs = Math.max(startedAt, lastTimestamp + 1)
      lastTimestamp = timestampMs

      const result = detector.detectForVideo(source, timestampMs)

      handlers.onFrame({
        timestampMs,
        latencyMs: clock() - startedAt,
        landmarks: result.landmarks[0] ?? null
      })
    } catch (error) {
      stopped = true
      handlers.onError(error)
      return
    }

    handle = source.requestVideoFrameCallback(onVideoFrame)
  }

  handle = source.requestVideoFrameCallback(onVideoFrame)

  return () => {
    stopped = true
    source.cancelVideoFrameCallback(handle)
  }
}
