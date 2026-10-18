import { describe, expect, it } from 'vitest'
import type { HandObservation } from './handFrame'
import { HAND_LANDMARK as H, type Landmark } from './landmarks'
import { HandControl, HOLD_MS } from './handControl'

// A hand that points with the tip of the index at (tipX, tipY) of the picture, as the camera sees
// it (not mirrored): the other fingers are folded.
function pointingHand(tipX: number, tipY = 0.5): HandObservation {
  const palm = 0.06
  const wrist = { x: tipX, y: tipY + 2.1 * palm }
  const point = (up: number, across = 0): Landmark => ({
    x: wrist.x + across * palm,
    y: wrist.y - up * palm,
    z: 0,
    visibility: 1
  })
  const landmarks = Array.from({ length: 21 }, () => point(0.3))
  landmarks[H.WRIST] = point(0)
  landmarks[H.INDEX_MCP] = point(1, -0.4)
  landmarks[H.INDEX_PIP] = point(1.45, -0.4)
  landmarks[H.INDEX_TIP] = { ...point(2.1), x: tipX, y: tipY }
  for (const [mcp, across] of [
    [H.MIDDLE_MCP, 0],
    [H.RING_MCP, 0.4],
    [H.PINKY_MCP, 0.8]
  ] as const) {
    landmarks[mcp] = point(1, across)
    landmarks[mcp + 1] = point(1.3, across)
    landmarks[mcp + 2] = point(1.1, across)
    landmarks[mcp + 3] = point(0.9, across)
  }
  return { handedness: 'right', score: 0.9, landmarks }
}

const openHand = (): HandObservation => {
  const hand = pointingHand(0.5)
  const landmarks = hand.landmarks.map((point, index) =>
    index === H.MIDDLE_TIP || index === H.RING_TIP || index === H.PINKY_TIP
      ? { ...point, y: point.y - 0.2 }
      : point
  )
  return { ...hand, landmarks }
}

// The camera sees the person's left side of the screen on the right of the picture.
const CAMERA_RIGHT = 0.9
const CAMERA_LEFT = 0.1

describe('HandControl', () => {
  it('mirrors the pointer, because the person sees the picture as in a mirror', () => {
    const control = new HandControl()

    const state = control.update([pointingHand(CAMERA_RIGHT, 0.4)], 0)

    expect(state.pointer?.x).toBeCloseTo(0.1)
    expect(state.pointer?.y).toBeCloseTo(0.4)
  })

  it('pauses when the finger stays on the zone at the left of what the person sees', () => {
    const control = new HandControl()
    control.update([pointingHand(CAMERA_RIGHT)], 0)

    const half = control.update([pointingHand(CAMERA_RIGHT)], HOLD_MS.pause / 2)
    expect(half.progress.pause).toBeCloseTo(0.5)
    expect(half.fired).toBeNull()

    expect(control.update([pointingHand(CAMERA_RIGHT)], HOLD_MS.pause).fired).toBe('pause')
  })

  it('finishes only after the longer hold, on the other side', () => {
    const control = new HandControl()
    control.update([pointingHand(CAMERA_LEFT)], 0)

    expect(control.update([pointingHand(CAMERA_LEFT)], HOLD_MS.pause).fired).toBeNull()
    expect(control.update([pointingHand(CAMERA_LEFT)], HOLD_MS.finish).fired).toBe('finish')
  })

  it('does nothing with an open hand, with no hand, or in the middle of the picture', () => {
    const control = new HandControl()

    for (let time = 0; time <= 5000; time += 100) {
      const state = control.update(
        [openHand(), ...(time % 200 === 0 ? [] : [pointingHand(0.5)])],
        time
      )
      expect(state.fired).toBeNull()
    }
    expect(control.update([], 6000).pointer).toBeNull()
  })

  it('follows the first hand that points when there are two', () => {
    const control = new HandControl()

    const state = control.update([openHand(), pointingHand(CAMERA_RIGHT)], 0)

    expect(state.pointer?.x).toBeCloseTo(0.1)
  })
})
