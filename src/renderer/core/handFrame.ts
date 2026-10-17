import type { Landmark } from './landmarks'

// Which hand it is, from the person's point of view.
export type Handedness = 'left' | 'right'

export interface HandObservation {
  handedness: Handedness
  // How sure the model is about the handedness (0..1).
  score: number
  // The 21 points of the hand, normalized to the image like the body ones.
  landmarks: Landmark[]
}

// The part of the model's answer that is read, so it can be faked in tests.
export interface HandsResultLike {
  landmarks: ReadonlyArray<ReadonlyArray<{ x: number; y: number; z: number; visibility?: number }>>
  handedness: ReadonlyArray<ReadonlyArray<{ categoryName: string; score: number }>>
}

export interface HandDetector<S> {
  detectForVideo: (source: S, timestampMs: number) => HandsResultLike
}

// What a frame carries about hands.
export interface HandsFrameData {
  observations: HandObservation[]
  // False when the hands were not looked for in this frame (time budget) and these are the last ones.
  fresh: boolean
  // How long looking for hands took in this frame; 0 when it was skipped.
  latencyMs: number
}

// The model assumes a mirrored (selfie) picture and the camera here is not mirrored, so the label it
// gives is the opposite of the person's real hand.
const REAL_HAND: Record<string, Handedness> = { Left: 'right', Right: 'left' }

export function toObservations(result: HandsResultLike): HandObservation[] {
  return result.landmarks.flatMap((points, index) => {
    const category = result.handedness[index]?.[0]
    const handedness = category ? REAL_HAND[category.categoryName] : undefined
    if (!category || !handedness) return []
    return [
      {
        handedness,
        score: category.score,
        landmarks: points.map((point) => ({
          x: point.x,
          y: point.y,
          z: point.z,
          visibility: point.visibility ?? 1
        }))
      }
    ]
  })
}
