import type { HandJointName } from '@shared/skill/joints'
import type { HandObservation, Handedness } from './handFrame'
import { HAND_LANDMARK as H, type Landmark } from './landmarks'

export const HAND_JOINT_INDEX: Record<HandJointName, number> = {
  handWrist: H.WRIST,
  thumbCmc: H.THUMB_CMC,
  thumbMcp: H.THUMB_MCP,
  thumbIp: H.THUMB_IP,
  thumbTip: H.THUMB_TIP,
  indexMcp: H.INDEX_MCP,
  indexPip: H.INDEX_PIP,
  indexDip: H.INDEX_DIP,
  indexTip: H.INDEX_TIP,
  middleMcp: H.MIDDLE_MCP,
  middlePip: H.MIDDLE_PIP,
  middleDip: H.MIDDLE_DIP,
  middleTip: H.MIDDLE_TIP,
  ringMcp: H.RING_MCP,
  ringPip: H.RING_PIP,
  ringDip: H.RING_DIP,
  ringTip: H.RING_TIP,
  pinkyMcp: H.PINKY_MCP,
  pinkyPip: H.PINKY_PIP,
  pinkyDip: H.PINKY_DIP,
  pinkyTip: H.PINKY_TIP
}

// The hand a skill is judged by: the one asked for, or with "auto" the one the model is surest of.
export function pickHand(
  hands: readonly HandObservation[],
  preference: Handedness | 'auto'
): HandObservation | null {
  const candidates =
    preference === 'auto' ? hands : hands.filter((hand) => hand.handedness === preference)
  return candidates.reduce<HandObservation | null>(
    (best, hand) => (best === null || hand.score > best.score ? hand : best),
    null
  )
}

export function handJoint(landmarks: readonly Landmark[], name: HandJointName): Landmark | null {
  return landmarks[HAND_JOINT_INDEX[name]] ?? null
}
