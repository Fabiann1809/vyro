import type { CheckState } from './framing'
import type { ObjectBox } from './objectFrame'

export type ObjectInstruction = 'showObject' | 'showWholeObject' | 'objectCloser' | 'objectBack'

export interface ObjectFramingReport {
  object: CheckState
  distance: CheckState
  // The one thing to fix first; null when everything is right.
  instruction: ObjectInstruction | null
}

// How much of the picture the longest side of the box should take: big enough to be followed,
// small enough not to be cut off.
const OBJECT_SPAN = { min: 0.2, max: 0.95 }

// A box closer than this to the edge is probably cut off by the frame.
const EDGE_MARGIN = 0.01

const isWhole = (box: ObjectBox): boolean =>
  box.x > EDGE_MARGIN &&
  box.y > EDGE_MARGIN &&
  box.x + box.width < 1 - EDGE_MARGIN &&
  box.y + box.height < 1 - EDGE_MARGIN

// Says whether the object is well placed in front of the camera, and what to fix first.
export function evaluateObjectFraming(box: ObjectBox | null): ObjectFramingReport {
  if (!box) return { object: 'pending', distance: 'pending', instruction: 'showObject' }

  if (!isWhole(box)) {
    return { object: 'fix', distance: 'pending', instruction: 'showWholeObject' }
  }
  const span = Math.max(box.width, box.height)
  if (span < OBJECT_SPAN.min) {
    return { object: 'ok', distance: 'fix', instruction: 'objectCloser' }
  }
  if (span > OBJECT_SPAN.max) {
    return { object: 'ok', distance: 'fix', instruction: 'objectBack' }
  }
  return { object: 'ok', distance: 'ok', instruction: null }
}
