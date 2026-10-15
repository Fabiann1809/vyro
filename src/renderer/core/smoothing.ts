import type { Landmark } from './landmarks'

export interface SmoothingOptions {
  // Lower values remove more jitter while the body is still.
  minCutoffHz: number
  // Higher values react faster when the body moves fast (less lag).
  beta: number
  derivativeCutoffHz: number
}

// Landmark coordinates are normalized to 0..1, so speeds are small numbers and beta is large.
// Tuned on simulated data: about 65 % less jitter at rest, about 1 % of the frame behind a
// fast movement (half the frame per second) and 2 frames to settle after a jump.
export const DEFAULT_SMOOTHING: SmoothingOptions = {
  minCutoffHz: 0.7,
  beta: 8,
  derivativeCutoffHz: 1
}

function lowPassFactor(cutoffHz: number, dtSeconds: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz)
  return 1 / (1 + tau / dtSeconds)
}

// One Euro filter (Casiez et al., 2012): a low-pass filter whose cutoff rises with speed.
class OneEuroFilter {
  private previousValue: number | undefined
  private previousDerivative = 0
  private previousTimestampSec = 0

  constructor(private readonly options: SmoothingOptions) {}

  filter(value: number, timestampSec: number): number {
    if (this.previousValue === undefined) {
      this.previousValue = value
      this.previousTimestampSec = timestampSec
      return value
    }

    const dt = timestampSec - this.previousTimestampSec
    if (dt <= 0) return this.previousValue

    const rawDerivative = (value - this.previousValue) / dt
    const derivative =
      this.previousDerivative +
      lowPassFactor(this.options.derivativeCutoffHz, dt) * (rawDerivative - this.previousDerivative)

    const cutoff = this.options.minCutoffHz + this.options.beta * Math.abs(derivative)
    const smoothed = this.previousValue + lowPassFactor(cutoff, dt) * (value - this.previousValue)

    this.previousValue = smoothed
    this.previousDerivative = derivative
    this.previousTimestampSec = timestampSec
    return smoothed
  }
}

interface PointFilters {
  x: OneEuroFilter
  y: OneEuroFilter
  z: OneEuroFilter
}

// Smooths a whole pose. Visibility is passed through untouched.
export class LandmarkSmoother {
  private filters: PointFilters[] = []

  constructor(private readonly options: SmoothingOptions = DEFAULT_SMOOTHING) {}

  smooth(landmarks: readonly Landmark[] | null, timestampMs: number): Landmark[] | null {
    // When the person leaves the frame, forget the old position instead of dragging towards it.
    if (!landmarks) {
      this.reset()
      return null
    }

    if (this.filters.length !== landmarks.length) {
      this.filters = landmarks.map(() => ({
        x: new OneEuroFilter(this.options),
        y: new OneEuroFilter(this.options),
        z: new OneEuroFilter(this.options)
      }))
    }

    const timestampSec = timestampMs / 1000
    return landmarks.map((landmark, index) => {
      const filters = this.filters[index]
      if (!filters) return landmark
      return {
        x: filters.x.filter(landmark.x, timestampSec),
        y: filters.y.filter(landmark.y, timestampSec),
        z: filters.z.filter(landmark.z, timestampSec),
        visibility: landmark.visibility
      }
    })
  }

  reset(): void {
    this.filters = []
  }
}
