import { lightInstruction, lightState, type CheckState } from './framing'
import { pickHand } from './handJoints'
import type { HandObservation, Handedness } from './handFrame'

export type HandInstruction =
  'showHands' | 'showWholeHand' | 'handsCloser' | 'handsBack' | 'moreLight' | 'lessLight'

export interface HandFramingReport {
  hands: CheckState
  distance: CheckState
  lighting: CheckState
  // The one thing to fix first; null when everything is right.
  instruction: HandInstruction | null
}

export interface HandFramingInput {
  hands: readonly HandObservation[]
  // The hand the skill is judged by.
  preference: Handedness | 'auto'
  // Average brightness of the picture (0..255); null until it has been measured.
  luminance: number | null
  frameSize: { width: number; height: number }
}

// How much of the frame height the hand should take, measured over its longest side: big enough
// for the fingers to be told apart, small enough not to be cut off.
const HAND_SPAN = { min: 0.2, max: 0.85 }

// A point closer than this to the edge is probably cut off by the frame.
const EDGE_MARGIN = 0.02

function span(hand: HandObservation, frame: HandFramingInput['frameSize']): number {
  const xs = hand.landmarks.map((point) => point.x)
  const ys = hand.landmarks.map((point) => point.y)
  const width = (Math.max(...xs) - Math.min(...xs)) * frame.width
  const height = (Math.max(...ys) - Math.min(...ys)) * frame.height
  return Math.max(width, height) / frame.height
}

const isWhole = (hand: HandObservation): boolean =>
  hand.landmarks.every(
    (point) =>
      point.x > EDGE_MARGIN &&
      point.x < 1 - EDGE_MARGIN &&
      point.y > EDGE_MARGIN &&
      point.y < 1 - EDGE_MARGIN
  )

// Says whether the hand is well placed in front of the camera, and what to fix first.
export function evaluateHandFraming(input: HandFramingInput): HandFramingReport {
  const { luminance, frameSize } = input
  const lighting = lightState(luminance)
  const light = lightInstruction(luminance)
  const hand = pickHand(input.hands, input.preference)

  if (!hand) {
    return {
      hands: 'pending',
      distance: 'pending',
      lighting,
      instruction: light ?? 'showHands'
    }
  }

  const whole = isWhole(hand)
  const size = span(hand, frameSize)
  const distance: CheckState = !whole
    ? 'pending'
    : size >= HAND_SPAN.min && size <= HAND_SPAN.max
      ? 'ok'
      : 'fix'
  const report = { hands: whole ? 'ok' : 'fix', distance, lighting } as const

  let instruction: HandInstruction | null = null
  if (light) instruction = light
  else if (!whole) instruction = 'showWholeHand'
  else if (distance === 'fix') instruction = size < HAND_SPAN.min ? 'handsCloser' : 'handsBack'
  return { ...report, instruction }
}
