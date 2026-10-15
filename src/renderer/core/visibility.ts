import type { Landmark } from './landmarks'

// Points the model is less sure about than this are treated as not seen.
export const MIN_VISIBILITY = 0.5

export function isVisible(
  landmark: Landmark | undefined,
  minVisibility: number = MIN_VISIBILITY
): landmark is Landmark {
  return landmark !== undefined && landmark.visibility >= minVisibility
}
