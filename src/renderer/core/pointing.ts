import { HAND_LANDMARK as H, HAND_LANDMARK_COUNT, type Landmark } from './landmarks'

// Pointing with one finger, to press a button from a distance without touching anything: the
// index is stretched out and the other three fingers are folded. An open hand, a fist or a hand
// that is playing something is not pointing, so a gesture made by chance does not press anything.

export interface Pointer {
  // Where the tip of the index is, in 0..1 of the picture.
  x: number
  y: number
}

const distance = (a: Landmark, b: Landmark): number => Math.hypot(a.x - b.x, a.y - b.y)

// Measured from the wrist, in palms (the distance from the wrist to the base of the middle finger),
// so it does not depend on how far the hand is from the camera.
const INDEX_STRETCHED = 1.7
const OTHERS_FOLDED = 1.45

const OTHER_TIPS = [H.MIDDLE_TIP, H.RING_TIP, H.PINKY_TIP]

// The tip of the index when the hand points, or null when it does not.
export function pointerOf(hand: readonly Landmark[]): Pointer | null {
  if (hand.length < HAND_LANDMARK_COUNT) return null
  const wrist = hand[H.WRIST]
  const palmBase = hand[H.MIDDLE_MCP]
  const indexTip = hand[H.INDEX_TIP]
  if (!wrist || !palmBase || !indexTip) return null

  const palm = distance(wrist, palmBase)
  if (palm === 0) return null

  if (distance(wrist, indexTip) / palm < INDEX_STRETCHED) return null
  for (const tipIndex of OTHER_TIPS) {
    const tip = hand[tipIndex]
    if (!tip || distance(wrist, tip) / palm > OTHERS_FOLDED) return null
  }
  return { x: indexTip.x, y: indexTip.y }
}
