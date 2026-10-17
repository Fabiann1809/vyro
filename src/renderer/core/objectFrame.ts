// A box around an object, in the same 0..1 coordinates of the image as the body and hand points.
export interface ObjectBox {
  x: number
  y: number
  width: number
  height: number
  // How sure the model is that it is the object (0..1).
  score: number
}

// The part of the model's answer that is read, so it can be faked in tests. The model gives the box
// in pixels of the picture it was shown.
export interface ObjectsResultLike {
  detections: ReadonlyArray<{
    boundingBox?: { originX: number; originY: number; width: number; height: number }
    categories: ReadonlyArray<{ categoryName: string; score: number }>
  }>
}

export interface ObjectDetectorLike<S> {
  detectForVideo: (source: S, timestampMs: number) => ObjectsResultLike
}

// What a frame carries about the object.
export interface ObjectsFrameData {
  // Smoothed; null when the object is not in view.
  box: ObjectBox | null
  // False when the object was not looked for in this frame (time budget) and this is the last box.
  fresh: boolean
  // How long looking for the object took in this frame; 0 when it was skipped.
  latencyMs: number
}

// The best box of the model, with the pixels turned into 0..1 of the picture.
export function toBox(result: ObjectsResultLike, width: number, height: number): ObjectBox | null {
  if (width <= 0 || height <= 0) return null
  let best: ObjectBox | null = null
  for (const detection of result.detections) {
    const box = detection.boundingBox
    const score = detection.categories[0]?.score
    if (!box || score === undefined || (best && best.score >= score)) continue
    best = {
      x: box.originX / width,
      y: box.originY / height,
      width: box.width / width,
      height: box.height / height,
      score
    }
  }
  return best
}

export function overlap(a: ObjectBox, b: ObjectBox): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  if (width <= 0 || height <= 0) return 0
  const shared = width * height
  return shared / (a.width * a.height + b.width * b.height - shared)
}

const DEFAULT_ALPHA = 0.5
// Below this overlap the new box is another object (or the object jumped): follow it at once.
const SAME_OBJECT_OVERLAP = 0.3
// How many frames in a row the object may go unseen before it counts as gone.
const DEFAULT_MAX_MISSED = 5

// Calms the shake of the box and bridges a frame or two where the model loses the object. A new
// box is blended with the last one; a box far from it is taken as it is, so it never lags behind.
export class BoxSmoother {
  private last: ObjectBox | null = null
  private missed = 0

  constructor(
    private readonly alpha: number = DEFAULT_ALPHA,
    private readonly maxMissed: number = DEFAULT_MAX_MISSED
  ) {}

  smooth(box: ObjectBox | null): ObjectBox | null {
    if (!box) {
      this.missed++
      if (this.missed > this.maxMissed) this.last = null
      return this.last
    }
    this.missed = 0
    const last = this.last
    this.last =
      last && overlap(last, box) >= SAME_OBJECT_OVERLAP
        ? {
            x: this.blend(last.x, box.x),
            y: this.blend(last.y, box.y),
            width: this.blend(last.width, box.width),
            height: this.blend(last.height, box.height),
            score: box.score
          }
        : box
    return this.last
  }

  reset(): void {
    this.last = null
    this.missed = 0
  }

  private blend(before: number, now: number): number {
    return before + (now - before) * this.alpha
  }
}
