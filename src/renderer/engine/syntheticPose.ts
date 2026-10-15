// Builds fake but anatomically plausible side-view poses, to test the engine without a camera.
// Used by the tests only: nothing in the app imports this file.

import type { PoseFrame } from '@renderer/core/detectionLoop'
import { POSE_LANDMARK_COUNT, type Landmark } from '@renderer/core/landmarks'
import {
  LandmarkRecorder,
  parseRecording,
  serializeRecording,
  type LandmarkRecording
} from '@renderer/core/recording'
import { JOINT_INDEX, type Side } from '@renderer/core/side'

export const FRAME_SIZE = { width: 1280, height: 720 }
export const FRAME_MS = 1000 / 30

// Lengths in pixels.
const SHIN = 200
const THIGH = 220
const TORSO = 280
const ANKLE = { x: 640, y: 640 }

interface SquatOptions {
  side?: Side
  // How far the torso leans from the vertical, in degrees.
  trunkLeanDeg?: number
}

const toLandmark = (x: number, y: number, visibility: number): Landmark => ({
  x: x / FRAME_SIZE.width,
  y: y / FRAME_SIZE.height,
  z: 0,
  visibility
})

// A person seen from the side, with the knee bent at `kneeAngleDeg` (180 = standing straight).
// Only the shoulder, hip, knee and ankle of the near side are visible.
export function squatPose(kneeAngleDeg: number, options: SquatOptions = {}): Landmark[] {
  const { side = 'left', trunkLeanDeg = 0 } = options
  const theta = (kneeAngleDeg * Math.PI) / 180
  const lean = (trunkLeanDeg * Math.PI) / 180

  const knee = { x: ANKLE.x, y: ANKLE.y - SHIN }
  const hip = { x: knee.x + THIGH * Math.sin(theta), y: knee.y + THIGH * Math.cos(theta) }
  const shoulder = { x: hip.x + TORSO * Math.sin(lean), y: hip.y - TORSO * Math.cos(lean) }

  const landmarks: Landmark[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0
  }))
  const near = JOINT_INDEX[side]
  const far = JOINT_INDEX[side === 'left' ? 'right' : 'left']

  landmarks[near.shoulder] = toLandmark(shoulder.x, shoulder.y, 0.98)
  landmarks[near.hip] = toLandmark(hip.x, hip.y, 0.98)
  landmarks[near.knee] = toLandmark(knee.x, knee.y, 0.98)
  landmarks[near.ankle] = toLandmark(ANKLE.x, ANKLE.y, 0.98)
  // The far side is hidden behind the body.
  landmarks[far.shoulder] = toLandmark(shoulder.x, shoulder.y, 0.1)
  landmarks[far.hip] = toLandmark(hip.x, hip.y, 0.1)
  landmarks[far.knee] = toLandmark(knee.x, knee.y, 0.1)
  landmarks[far.ankle] = toLandmark(ANKLE.x, ANKLE.y, 0.1)

  return landmarks
}

// One smooth squat from standing, down to `bottomDeg` and back up, over `frames` frames.
export function squatAngles(frames: number, bottomDeg = 90, topDeg = 175): number[] {
  const middle = (topDeg + bottomDeg) / 2
  const amplitude = (topDeg - bottomDeg) / 2
  return Array.from(
    { length: frames },
    (_, frame) => middle + amplitude * Math.cos((2 * Math.PI * frame) / frames)
  )
}

export const standingAngles = (frames: number, topDeg = 175): number[] => Array(frames).fill(topDeg)

// Records knee angles (null = nobody in view) the same way the app does, then reads the
// recording back from its text form, so the whole recording path is exercised too.
export function recordKneeAngles(
  angles: ReadonlyArray<number | null>,
  options: SquatOptions = {}
): LandmarkRecording {
  const recorder = new LandmarkRecorder(FRAME_SIZE, 'synthetic', () => new Date(0))

  angles.forEach((angle, index) => {
    const frame: PoseFrame = {
      timestampMs: index * FRAME_MS,
      latencyMs: 0,
      presentedFrames: index,
      landmarks: angle === null ? null : squatPose(angle, options)
    }
    recorder.add(frame)
  })

  const parsed = parseRecording(serializeRecording(recorder.finish()))
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.recording
}
