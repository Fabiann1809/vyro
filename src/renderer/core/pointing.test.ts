import { describe, expect, it } from 'vitest'
import { HAND_LANDMARK as H, type Landmark } from './landmarks'
import { pointerOf } from './pointing'

// A right hand seen from the front with the fingers up. The distances are in palms: the base of
// the middle finger is one palm from the wrist.
const PALM = 0.1
const WRIST = { x: 0.5, y: 0.8 }

const at = (across: number, palms: number): Landmark => ({
  x: WRIST.x + across * PALM,
  y: WRIST.y - palms * PALM,
  z: 0,
  visibility: 1
})

type Finger = 'stretched' | 'folded'

// The four points of a finger, from its base to its tip.
function finger(across: number, state: Finger): Landmark[] {
  return state === 'stretched'
    ? [at(across, 1), at(across, 1.45), at(across, 1.75), at(across, 2.05)]
    : [at(across, 1), at(across, 1.3), at(across, 1.1), at(across, 0.9)]
}

function hand(fingers: { index: Finger; middle: Finger; ring: Finger; pinky: Finger }): Landmark[] {
  const points = Array.from({ length: 21 }, () => at(0, 0.3))
  points[H.WRIST] = at(0, 0)
  const place = (first: number, across: number, state: Finger): void => {
    finger(across, state).forEach((point, offset) => (points[first + offset] = point))
  }
  place(H.INDEX_MCP, -0.4, fingers.index)
  place(H.MIDDLE_MCP, 0, fingers.middle)
  place(H.RING_MCP, 0.4, fingers.ring)
  place(H.PINKY_MCP, 0.8, fingers.pinky)
  return points
}

const pointing = hand({ index: 'stretched', middle: 'folded', ring: 'folded', pinky: 'folded' })

describe('pointerOf', () => {
  it('gives the tip of the index when only the index is stretched', () => {
    const tip = pointing[H.INDEX_TIP]

    expect(pointerOf(pointing)).toEqual({ x: tip?.x, y: tip?.y })
  })

  it('does not depend on how far the hand is from the camera', () => {
    const far = pointing.map((point) => ({
      ...point,
      x: WRIST.x + (point.x - WRIST.x) / 4,
      y: WRIST.y + (point.y - WRIST.y) / 4
    }))

    expect(pointerOf(far)).not.toBeNull()
  })

  it.each([
    [
      'an open hand',
      { index: 'stretched', middle: 'stretched', ring: 'stretched', pinky: 'stretched' }
    ],
    ['a fist', { index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' }],
    ['two fingers', { index: 'stretched', middle: 'stretched', ring: 'folded', pinky: 'folded' }],
    [
      'the little finger only',
      { index: 'folded', middle: 'folded', ring: 'folded', pinky: 'stretched' }
    ]
  ] as const)('is not pointing with %s', (_name, fingers) => {
    expect(pointerOf(hand(fingers))).toBeNull()
  })

  it('says nothing when the hand is incomplete or has no size', () => {
    expect(pointerOf(pointing.slice(0, 10))).toBeNull()
    expect(pointerOf(pointing.map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })))).toBeNull()
  })
})
