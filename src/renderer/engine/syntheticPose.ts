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
import { JOINT_INDEX, type JointName, type Side } from '@renderer/core/side'

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

type Point = { x: number; y: number }
type Joints = Partial<Record<JointName, Point>>

// Puts the given joints on the near side of the body and hides the far side behind it.
function sidePose(joints: Joints, side: Side): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0
  }))
  const far: Side = side === 'left' ? 'right' : 'left'

  for (const [name, point] of Object.entries(joints) as Array<[JointName, Point]>) {
    landmarks[JOINT_INDEX[side][name]] = toLandmark(point.x, point.y, 0.98)
    landmarks[JOINT_INDEX[far][name]] = toLandmark(point.x, point.y, 0.1)
  }
  return landmarks
}

const rad = (degrees: number): number => (degrees * Math.PI) / 180

// A person seen from the side, with the knee bent at `kneeAngleDeg` (180 = standing straight).
// Only the shoulder, hip, knee and ankle of the near side are visible.
export function squatPose(kneeAngleDeg: number, options: SquatOptions = {}): Landmark[] {
  const { side = 'left', trunkLeanDeg = 0 } = options
  const theta = rad(kneeAngleDeg)
  const lean = rad(trunkLeanDeg)

  const knee = { x: ANKLE.x, y: ANKLE.y - SHIN }
  const hip = { x: knee.x + THIGH * Math.sin(theta), y: knee.y + THIGH * Math.cos(theta) }
  const shoulder = { x: hip.x + TORSO * Math.sin(lean), y: hip.y - TORSO * Math.cos(lean) }

  return sidePose({ shoulder, hip, knee, ankle: ANKLE }, side)
}

interface PushupOptions {
  side?: Side
  // How far the hips drop below the straight line of the body, in degrees (negative = hips up).
  hipSagDeg?: number
}

// A person doing a push-up seen from the side, with the elbow bent at `elbowAngleDeg`
// (180 = arms straight). The wrist stays on the floor.
export function pushupPose(elbowAngleDeg: number, options: PushupOptions = {}): Landmark[] {
  const { side = 'left', hipSagDeg = 0 } = options
  const phi = rad(180 - elbowAngleDeg)

  const wrist = { x: 1100, y: 600 }
  const elbow = { x: wrist.x, y: wrist.y - 200 }
  const shoulder = { x: elbow.x - 200 * Math.sin(phi), y: elbow.y - 200 * Math.cos(phi) }

  // From the shoulder toward the feet, almost level.
  const toFeet = Math.atan2(0.15, -1)
  const hip = { x: shoulder.x + 300 * Math.cos(toFeet), y: shoulder.y + 300 * Math.sin(toFeet) }
  const legs = toFeet - rad(hipSagDeg)
  const ankle = { x: hip.x + 330 * Math.cos(legs), y: hip.y + 330 * Math.sin(legs) }
  const knee = { x: (hip.x + ankle.x) / 2, y: (hip.y + ankle.y) / 2 }

  return sidePose({ shoulder, elbow, wrist, hip, knee, ankle }, side)
}

interface CurlOptions {
  side?: Side
  // How far the elbow travels forward at the top of the curl, as a fraction of the upper arm.
  elbowDrift?: number
  // How far the torso leans back at the top of the curl, in degrees.
  swingDeg?: number
}

const CURL_TOP_DEG = 170
const CURL_BOTTOM_DEG = 40

// A person standing and curling, seen from the side, with the elbow bent at `elbowAngleDeg`
// (180 = arm hanging straight). The more the arm is curled, the more drift and swing apply.
export function curlPose(elbowAngleDeg: number, options: CurlOptions = {}): Landmark[] {
  const { side = 'left', elbowDrift = 0, swingDeg = 0 } = options
  const curled = Math.min(
    1,
    Math.max(0, (CURL_TOP_DEG - elbowAngleDeg) / (CURL_TOP_DEG - CURL_BOTTOM_DEG))
  )
  const lean = rad(-swingDeg * curled)

  const hip = { x: 640, y: 420 }
  const shoulder = { x: hip.x + 300 * Math.sin(lean), y: hip.y - 300 * Math.cos(lean) }
  const elbow = { x: shoulder.x + elbowDrift * curled * 220, y: shoulder.y + 220 }
  // The forearm is the upper arm turned by the elbow angle, so the angle stays exact even when
  // the elbow drifts and the upper arm is no longer vertical.
  const upperArm = Math.hypot(shoulder.x - elbow.x, shoulder.y - elbow.y)
  const ux = (shoulder.x - elbow.x) / upperArm
  const uy = (shoulder.y - elbow.y) / upperArm
  const theta = rad(elbowAngleDeg)
  const wrist = {
    x: elbow.x + 200 * (ux * Math.cos(theta) - uy * Math.sin(theta)),
    y: elbow.y + 200 * (ux * Math.sin(theta) + uy * Math.cos(theta))
  }
  const ankle = { x: hip.x, y: hip.y + 400 }
  const knee = { x: hip.x, y: hip.y + 200 }

  return sidePose({ shoulder, elbow, wrist, hip, knee, ankle }, side)
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

// Records poses (null = nobody in view) the same way the app does, then reads the recording
// back from its text form, so the whole recording path is exercised too.
export function recordPoses(poses: ReadonlyArray<Landmark[] | null>): LandmarkRecording {
  const recorder = new LandmarkRecorder(FRAME_SIZE, 'synthetic', () => new Date(0))

  poses.forEach((landmarks, index) => {
    const frame: PoseFrame = {
      timestampMs: index * FRAME_MS,
      latencyMs: 0,
      presentedFrames: index,
      landmarks
    }
    recorder.add(frame)
  })

  const parsed = parseRecording(serializeRecording(recorder.finish()))
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.recording
}

export const recordKneeAngles = (
  angles: ReadonlyArray<number | null>,
  options: SquatOptions = {}
): LandmarkRecording =>
  recordPoses(angles.map((angle) => (angle === null ? null : squatPose(angle, options))))

export const recordPushupAngles = (
  angles: ReadonlyArray<number | null>,
  options: PushupOptions = {}
): LandmarkRecording =>
  recordPoses(angles.map((angle) => (angle === null ? null : pushupPose(angle, options))))

export const recordCurlAngles = (
  angles: ReadonlyArray<number | null>,
  options: CurlOptions = {}
): LandmarkRecording =>
  recordPoses(angles.map((angle) => (angle === null ? null : curlPose(angle, options))))
