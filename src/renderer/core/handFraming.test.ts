import { describe, expect, it } from 'vitest'
import { CalibrationFlow } from './calibrationFlow'
import { evaluateHandFraming, type HandFramingInput } from './handFraming'
import type { HandObservation } from './handFrame'
import { HAND_LANDMARK_COUNT } from './landmarks'

const FRAME = { width: 1280, height: 720 }

// A hand whose points are spread over a box: the corners of the box are real points of the hand.
function hand(
  box: { left: number; top: number; width: number; height: number },
  handedness: 'left' | 'right' = 'right',
  score = 0.9
): HandObservation {
  return {
    handedness,
    score,
    landmarks: Array.from({ length: HAND_LANDMARK_COUNT }, (_, index) => ({
      x: box.left + (index % 2 === 0 ? 0 : box.width),
      y: box.top + (index < 10 ? 0 : box.height),
      z: 0,
      visibility: 1
    }))
  }
}

const GOOD = hand({ left: 0.4, top: 0.25, width: 0.15, height: 0.5 })

function evaluate(changes: Partial<HandFramingInput> = {}): ReturnType<typeof evaluateHandFraming> {
  return evaluateHandFraming({
    hands: [GOOD],
    preference: 'auto',
    luminance: 120,
    frameSize: FRAME,
    ...changes
  })
}

describe('evaluateHandFraming', () => {
  it('is all right for a whole hand, at a good distance, in good light', () => {
    expect(evaluate()).toEqual({ hands: 'ok', distance: 'ok', lighting: 'ok', instruction: null })
  })

  it('asks to show the hand when there is none', () => {
    expect(evaluate({ hands: [] })).toMatchObject({ hands: 'pending', instruction: 'showHands' })
  })

  it('asks for the hand that the skill needs, not any', () => {
    const report = evaluate({ hands: [GOOD], preference: 'left' })

    expect(report.instruction).toBe('showHands')
    expect(evaluate({ hands: [GOOD], preference: 'right' }).instruction).toBeNull()
  })

  it('asks to show the whole hand when it is cut off by the frame', () => {
    const cut = hand({ left: 0.9, top: 0.25, width: 0.15, height: 0.5 })

    expect(evaluate({ hands: [cut] })).toMatchObject({
      hands: 'fix',
      instruction: 'showWholeHand'
    })
  })

  it('asks to come closer when the hand is small, and back when it is too big', () => {
    const small = hand({ left: 0.45, top: 0.4, width: 0.05, height: 0.12 })
    const big = hand({ left: 0.1, top: 0.05, width: 0.5, height: 0.9 })

    expect(evaluate({ hands: [small] }).instruction).toBe('handsCloser')
    expect(evaluate({ hands: [big] })).toMatchObject({
      distance: 'fix',
      instruction: 'handsBack'
    })
  })

  it('asks for more light before anything else', () => {
    expect(evaluate({ luminance: 20 })).toMatchObject({ lighting: 'fix', instruction: 'moreLight' })
    expect(evaluate({ hands: [], luminance: 20 }).instruction).toBe('moreLight')
  })

  it('waits for the light to be measured', () => {
    expect(evaluate({ luminance: null })).toMatchObject({ lighting: 'pending', instruction: null })
  })
})

describe('starting with hands', () => {
  it('does not start the countdown while no hand is in view', () => {
    const flow = new CalibrationFlow()
    const states = [0, 400, 800, 1200, 1600, 2000].map((time) =>
      flow.update(evaluate({ hands: [] }).instruction === null, time)
    )

    expect(states.every((state) => state.phase === 'checking')).toBe(true)
  })

  it('starts it once the hand is well placed and stays so', () => {
    const flow = new CalibrationFlow()
    const states = [0, 400, 800, 1200].map((time) =>
      flow.update(evaluate().instruction === null, time)
    )

    expect(states.at(-1)?.phase).toBe('countdown')
  })
})
