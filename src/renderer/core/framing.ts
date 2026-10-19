import type { Landmark } from './landmarks'
import { joint, pickVisibleSide, type JointName, type Side } from './side'

export type CheckState = 'pending' | 'ok' | 'fix'

export type FramingInstruction =
  | 'stepIntoView'
  | 'showFullBody'
  | 'showUpperBody'
  | 'moveBack'
  | 'moveCloser'
  | 'turnSideways'
  | 'moreLight'
  | 'lessLight'

export interface FramingReport {
  fullBody: CheckState
  profile: CheckState
  distance: CheckState
  lighting: CheckState
  // The one thing to fix first; null when everything is right.
  instruction: FramingInstruction | null
}

export interface FramingInput {
  landmarks: readonly Landmark[] | null
  // Average brightness of the picture (0..255); null until it has been measured.
  luminance: number | null
  frameSize: { width: number; height: number }
  camera: { view: 'side' | 'front'; fullBody: boolean }
}

// Fraction of the frame height the tracked body should fill: not too far, not cut off.
const FULL_BODY_SPAN = { min: 0.55, max: 0.92 }
const UPPER_BODY_SPAN = { min: 0.2, max: 0.6 }

// A joint closer than this to the edge is probably cut off by the frame.
const EDGE_MARGIN = 0.02

const MIN_LUMINANCE = 60
// A picture this bright is washed out: the camera loses the edges of the hand and the body.
const MAX_LUMINANCE = 200

type LightProblem = 'dark' | 'bright'

function lightProblem(luminance: number | null): LightProblem | null {
  if (luminance === null) return null
  if (luminance < MIN_LUMINANCE) return 'dark'
  return luminance > MAX_LUMINANCE ? 'bright' : null
}

export const lightState = (luminance: number | null): CheckState =>
  luminance === null ? 'pending' : lightProblem(luminance) ? 'fix' : 'ok'

export const lightInstruction = (luminance: number | null): 'moreLight' | 'lessLight' | null => {
  const problem = lightProblem(luminance)
  return problem === null ? null : problem === 'dark' ? 'moreLight' : 'lessLight'
}

// In profile the shoulders overlap: their gap is small next to the length of the torso.
const MAX_PROFILE_SHOULDER_RATIO = 0.35

const FULL_BODY_JOINTS: readonly JointName[] = ['shoulder', 'hip', 'knee', 'ankle']
const UPPER_BODY_JOINTS: readonly JointName[] = ['shoulder', 'elbow', 'wrist', 'hip']

const inFrame = (landmark: Landmark): boolean =>
  landmark.x > EDGE_MARGIN &&
  landmark.x < 1 - EDGE_MARGIN &&
  landmark.y > EDGE_MARGIN &&
  landmark.y < 1 - EDGE_MARGIN

function trackedJoints(
  landmarks: readonly Landmark[],
  side: Side,
  names: readonly JointName[]
): Landmark[] | null {
  const found = names.map((name) => joint(landmarks, name, side))
  return found.every((landmark): landmark is Landmark => landmark !== null) ? found : null
}

function distanceState(body: readonly Landmark[], span: { min: number; max: number }): CheckState {
  const ys = body.map((landmark) => landmark.y)
  const height = Math.max(...ys) - Math.min(...ys)
  return height >= span.min && height <= span.max ? 'ok' : 'fix'
}

// 'fix' when the body is too big for the frame, so the instruction can say which way to move.
function tooClose(body: readonly Landmark[], span: { min: number; max: number }): boolean {
  const ys = body.map((landmark) => landmark.y)
  return Math.max(...ys) - Math.min(...ys) > span.max
}

function profileState(
  landmarks: readonly Landmark[],
  side: Side,
  frameSize: FramingInput['frameSize']
): CheckState {
  const far: Side = side === 'left' ? 'right' : 'left'
  const nearShoulder = joint(landmarks, 'shoulder', side)
  const nearHip = joint(landmarks, 'hip', side)
  const farShoulder = joint(landmarks, 'shoulder', far)
  if (!nearShoulder || !nearHip) return 'pending'
  // A shoulder hidden behind the body is exactly what a profile looks like.
  if (!farShoulder) return 'ok'

  const gap = Math.abs(farShoulder.x - nearShoulder.x) * frameSize.width
  const torso = Math.hypot(
    (nearShoulder.x - nearHip.x) * frameSize.width,
    (nearShoulder.y - nearHip.y) * frameSize.height
  )
  return torso > 0 && gap / torso <= MAX_PROFILE_SHOULDER_RATIO ? 'ok' : 'fix'
}

function firstInstruction(
  report: Omit<FramingReport, 'instruction'>,
  light: FramingInstruction | null,
  close: boolean,
  fullBody: boolean
): FramingInstruction | null {
  if (light) return light
  if (report.fullBody === 'pending') return 'stepIntoView'
  if (report.fullBody === 'fix') return fullBody ? 'showFullBody' : 'showUpperBody'
  if (report.distance === 'fix') return close ? 'moveBack' : 'moveCloser'
  if (report.profile === 'fix') return 'turnSideways'
  return null
}

// Says whether the person is well placed in front of the camera, and what to fix first.
export function evaluateFraming(input: FramingInput): FramingReport {
  const { landmarks, luminance, frameSize, camera } = input
  const lighting = lightState(luminance)
  const light = lightInstruction(luminance)
  const side = pickVisibleSide(landmarks)

  if (!landmarks || !side) {
    const report = {
      fullBody: 'pending',
      profile: 'pending',
      distance: 'pending',
      lighting
    } as const
    return { ...report, instruction: firstInstruction(report, light, false, camera.fullBody) }
  }

  const names = camera.fullBody ? FULL_BODY_JOINTS : UPPER_BODY_JOINTS
  const span = camera.fullBody ? FULL_BODY_SPAN : UPPER_BODY_SPAN
  const body = trackedJoints(landmarks, side, names)
  const complete = body !== null && body.every(inFrame)

  const profile: CheckState =
    camera.view === 'side' ? profileState(landmarks, side, frameSize) : 'ok'
  const report = {
    fullBody: complete ? 'ok' : 'fix',
    profile,
    distance: complete ? distanceState(body, span) : 'pending',
    lighting
  } as const

  const close = complete && tooClose(body, span)
  return { ...report, instruction: firstInstruction(report, light, close, camera.fullBody) }
}
