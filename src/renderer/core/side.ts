import { POSE_LANDMARK as P, type Landmark } from './landmarks'
import { JOINT_NAMES, type JointName } from '@shared/skill/joints'
import { isVisible, MIN_VISIBILITY } from './visibility'

// In a side view the camera sees one side of the body well and the other one hidden behind it.
export type Side = 'left' | 'right'

export { JOINT_NAMES, type JointName }

export const JOINT_INDEX: Record<Side, Record<JointName, number>> = {
  left: {
    shoulder: P.LEFT_SHOULDER,
    elbow: P.LEFT_ELBOW,
    wrist: P.LEFT_WRIST,
    hip: P.LEFT_HIP,
    knee: P.LEFT_KNEE,
    ankle: P.LEFT_ANKLE,
    heel: P.LEFT_HEEL,
    footIndex: P.LEFT_FOOT_INDEX
  },
  right: {
    shoulder: P.RIGHT_SHOULDER,
    elbow: P.RIGHT_ELBOW,
    wrist: P.RIGHT_WRIST,
    hip: P.RIGHT_HIP,
    knee: P.RIGHT_KNEE,
    ankle: P.RIGHT_ANKLE,
    heel: P.RIGHT_HEEL,
    footIndex: P.RIGHT_FOOT_INDEX
  }
}

// The joints every exercise of the MVP is judged by.
const SCORED_JOINTS: readonly JointName[] = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle']

// Below this average visibility a side is not considered to be in view at all.
export const MIN_SIDE_SCORE = 0.4

// A side must beat the current one by this much before the tracker switches to it.
export const SIDE_SWITCH_MARGIN = 0.15

// Returns the joint on the given side, or null when the model does not see it well enough.
export function joint(
  landmarks: readonly Landmark[],
  name: JointName,
  side: Side,
  minVisibility: number = MIN_VISIBILITY
): Landmark | null {
  const landmark = landmarks[JOINT_INDEX[side][name]]
  return isVisible(landmark, minVisibility) ? landmark : null
}

// Average visibility (0..1) of the main joints of one side.
export function sideScore(landmarks: readonly Landmark[], side: Side): number {
  const total = SCORED_JOINTS.reduce((sum, name) => {
    return sum + (landmarks[JOINT_INDEX[side][name]]?.visibility ?? 0)
  }, 0)
  return total / SCORED_JOINTS.length
}

// The better seen side, or null when neither side is in view. A tie goes to the left side.
export function pickVisibleSide(landmarks: readonly Landmark[] | null): Side | null {
  if (!landmarks) return null

  const left = sideScore(landmarks, 'left')
  const right = sideScore(landmarks, 'right')
  const best: Side = right > left ? 'right' : 'left'

  return Math.max(left, right) >= MIN_SIDE_SCORE ? best : null
}

// Like pickVisibleSide, but keeps the current side until the other one is clearly better,
// so the choice does not flicker when both sides are seen about equally.
export class SideTracker {
  private current: Side | null = null

  update(landmarks: readonly Landmark[] | null): Side | null {
    const candidate = pickVisibleSide(landmarks)

    if (!landmarks || !candidate) {
      this.current = null
      return null
    }

    if (this.current === null || candidate === this.current) {
      this.current = candidate
      return this.current
    }

    const advantage = sideScore(landmarks, candidate) - sideScore(landmarks, this.current)
    if (advantage >= SIDE_SWITCH_MARGIN) this.current = candidate
    return this.current
  }

  reset(): void {
    this.current = null
  }
}
