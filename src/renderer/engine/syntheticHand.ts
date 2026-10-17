// Builds fake but plausible hands seen from the side, to test the engine without a camera.
// Used by the tests only: nothing in the app imports this file.

import { HAND_LANDMARK as H, HAND_LANDMARK_COUNT, type Landmark } from '@renderer/core/landmarks'
import { FRAME_MS, FRAME_SIZE } from './syntheticPose'

export { FRAME_MS, FRAME_SIZE }

// Lengths in pixels.
const PALM = 200
const PROXIMAL = 110
const MIDDLE = 70
const DISTAL = 55
const WRIST = { x: 300, y: 360 }

const rad = (degrees: number): number => (degrees * Math.PI) / 180

export interface FingerPose {
  // Direction of the palm from the wrist, from the horizontal; positive is downwards.
  wristDeg: number
  // Direction of the first bone of the index finger, from the horizontal, positive downwards.
  proximalDeg: number
  // How much the finger bends at its two joints: the angle at the joint is 180 minus this.
  pipFlexDeg: number
  dipFlexDeg: number
}

const toLandmark = (point: { x: number; y: number }): Landmark => ({
  x: point.x / FRAME_SIZE.width,
  y: point.y / FRAME_SIZE.height,
  z: 0,
  visibility: 1
})

const along = (
  from: { x: number; y: number },
  degrees: number,
  length: number
): { x: number; y: number } => ({
  x: from.x + Math.cos(rad(degrees)) * length,
  y: from.y + Math.sin(rad(degrees)) * length
})

// The 21 points of a hand with the index finger posed as asked; the other fingers follow it so the
// whole is a believable hand.
export function handPose(pose: FingerPose): Landmark[] {
  const points = Array.from({ length: HAND_LANDMARK_COUNT }, () => ({ ...WRIST }))
  const middleMcp = along(WRIST, pose.wristDeg, PALM)
  const finger = (
    mcp: { x: number; y: number },
    scale: number
  ): Array<{ x: number; y: number }> => {
    const pip = along(mcp, pose.proximalDeg, PROXIMAL * scale)
    const dip = along(pip, pose.proximalDeg + pose.pipFlexDeg, MIDDLE * scale)
    const tip = along(dip, pose.proximalDeg + pose.pipFlexDeg + pose.dipFlexDeg, DISTAL * scale)
    return [mcp, pip, dip, tip]
  }

  const place = (start: number, finger4: Array<{ x: number; y: number }>): void => {
    finger4.forEach((point, index) => {
      points[start + index] = point
    })
  }
  place(H.INDEX_MCP, finger(along(WRIST, pose.wristDeg, PALM * 0.95), 1))
  place(H.MIDDLE_MCP, finger(middleMcp, 1.05))
  place(H.RING_MCP, finger(along(WRIST, pose.wristDeg, PALM * 0.93), 0.95))
  place(H.PINKY_MCP, finger(along(WRIST, pose.wristDeg, PALM * 0.88), 0.8))
  place(H.THUMB_CMC, [
    along(WRIST, pose.wristDeg + 40, PALM * 0.3),
    along(WRIST, pose.wristDeg + 40, PALM * 0.55),
    along(WRIST, pose.wristDeg + 35, PALM * 0.8),
    along(WRIST, pose.wristDeg + 30, PALM * 1.0)
  ])
  return points.map(toLandmark)
}

export interface HandFrame {
  timestampMs: number
  hand: Landmark[]
}

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount

// One key press: the finger goes from resting on the key to lifted and back, over `frames` frames.
// `rest` and `lifted` are the two poses; `wristDeg` is held all along.
export function pressFrames(
  rest: Omit<FingerPose, 'wristDeg'>,
  lifted: Omit<FingerPose, 'wristDeg'>,
  wristDeg: number,
  frames: number,
  startMs: number
): HandFrame[] {
  return Array.from({ length: frames }, (_, index) => {
    // 0 at rest, 1 fully lifted, back to 0.
    const amount = (1 - Math.cos((2 * Math.PI * index) / (frames - 1))) / 2
    return {
      timestampMs: startMs + index * FRAME_MS,
      hand: handPose({
        wristDeg,
        proximalDeg: lerp(rest.proximalDeg, lifted.proximalDeg, amount),
        pipFlexDeg: lerp(rest.pipFlexDeg, lifted.pipFlexDeg, amount),
        dipFlexDeg: lerp(rest.dipFlexDeg, lifted.dipFlexDeg, amount)
      })
    }
  })
}

// The finger resting for a while, for the start and the end of a set.
export function restFrames(
  rest: Omit<FingerPose, 'wristDeg'>,
  wristDeg: number,
  frames: number,
  startMs: number
): HandFrame[] {
  return Array.from({ length: frames }, (_, index) => ({
    timestampMs: startMs + index * FRAME_MS,
    hand: handPose({ wristDeg, ...rest })
  }))
}
