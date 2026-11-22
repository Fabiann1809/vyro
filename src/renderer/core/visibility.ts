import type { Landmark } from './landmarks'

// Points the model is less sure about than this are treated as not seen.
export const MIN_VISIBILITY = 0.5

// Once the person is placed, a joint is still followed with less certainty than that. When a forearm
// comes up in front of the body the model doubts the wrist and the elbow for a moment, and a curl
// that loses them at the top is never counted. Placing the person (calibration) keeps the stricter
// limit above.
export const TRACKING_VISIBILITY = 0.3

export function isVisible(
  landmark: Landmark | undefined,
  minVisibility: number = MIN_VISIBILITY
): landmark is Landmark {
  return landmark !== undefined && landmark.visibility >= minVisibility
}
