import {
  toObservations,
  type HandBudget,
  type HandDetector,
  type HandObservation,
  type HandsFrameData
} from './handFrame'
import type { Landmark } from './landmarks'

export interface PoseFrame {
  timestampMs: number
  latencyMs: number
  // Video frames the camera has shown so far. Gaps between two processed frames are skipped frames.
  presentedFrames: number
  // Null when nobody is in view.
  landmarks: Landmark[] | null
  // Only when hands are being looked for.
  hands?: HandsFrameData
}

// The two small interfaces below are all the loop needs, so it can be tested without a camera.
export interface FrameMetadata {
  presentedFrames: number
}

export interface FrameSource {
  requestVideoFrameCallback: (callback: (now: number, metadata: FrameMetadata) => void) => number
  cancelVideoFrameCallback: (handle: number) => void
}

export interface PoseDetector<S> {
  detectForVideo: (source: S, timestampMs: number) => { landmarks: Landmark[][] }
}

// Looking for hands as well, with a time budget so that the body keeps its frame rate.
export interface HandsOptions<S> {
  detector: HandDetector<S>
  budget: HandBudget
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
  clock: () => number = () => performance.now(),
  hands?: HandsOptions<S>
): () => void {
  let handle = 0
  let stopped = false
  let lastTimestamp = -1
  let lastHands: HandObservation[] = []

  const onVideoFrame = (_now: number, metadata: FrameMetadata): void => {
    if (stopped) return

    try {
      const startedAt = clock()
      // The model requires strictly increasing timestamps.
      const timestampMs = Math.max(startedAt, lastTimestamp + 1)
      lastTimestamp = timestampMs

      const result = detector.detectForVideo(source, timestampMs)
      const bodyLatencyMs = clock() - startedAt

      let handsFrame: HandsFrameData | undefined
      if (hands) {
        const fresh = hands.budget.shouldRun(bodyLatencyMs)
        let latencyMs = 0
        if (fresh) {
          const handsStartedAt = clock()
          lastHands = toObservations(hands.detector.detectForVideo(source, timestampMs))
          latencyMs = clock() - handsStartedAt
          hands.budget.record(latencyMs)
        }
        handsFrame = { observations: lastHands, fresh, latencyMs }
      }

      handlers.onFrame({
        timestampMs,
        latencyMs: bodyLatencyMs,
        presentedFrames: metadata.presentedFrames,
        landmarks: result.landmarks[0] ?? null,
        ...(handsFrame ? { hands: handsFrame } : {})
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
