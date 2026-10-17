import { describe, expect, it } from 'vitest'
import { BoxSmoother, overlap, toBox, type ObjectBox, type ObjectsResultLike } from './objectFrame'

const box = (x: number, y: number, size = 0.2, score = 0.9): ObjectBox => ({
  x,
  y,
  width: size,
  height: size,
  score
})

const detection = (
  originX: number,
  originY: number,
  width: number,
  height: number,
  score: number
): ObjectsResultLike['detections'][number] => ({
  boundingBox: { originX, originY, width, height },
  categories: [{ categoryName: 'Guitar', score }]
})

describe('toBox', () => {
  it('turns the pixels of the model into 0..1 of the picture', () => {
    const result: ObjectsResultLike = { detections: [detection(160, 120, 320, 240, 0.8)] }

    expect(toBox(result, 640, 480)).toEqual({
      x: 0.25,
      y: 0.25,
      width: 0.5,
      height: 0.5,
      score: 0.8
    })
  })

  it('keeps the most certain box when there are several', () => {
    const result: ObjectsResultLike = {
      detections: [detection(0, 0, 64, 48, 0.5), detection(320, 240, 64, 48, 0.9)]
    }

    expect(toBox(result, 640, 480)?.score).toBe(0.9)
  })

  it('is null when nothing was found or the picture has no size yet', () => {
    expect(toBox({ detections: [] }, 640, 480)).toBeNull()
    expect(toBox({ detections: [detection(0, 0, 10, 10, 0.9)] }, 0, 0)).toBeNull()
  })

  it('ignores a detection that comes without a box', () => {
    const result: ObjectsResultLike = {
      detections: [{ categories: [{ categoryName: 'Guitar', score: 0.9 }] }]
    }

    expect(toBox(result, 640, 480)).toBeNull()
  })
})

describe('overlap', () => {
  it('is 1 for the same box and 0 for boxes apart', () => {
    expect(overlap(box(0.1, 0.1), box(0.1, 0.1))).toBeCloseTo(1)
    expect(overlap(box(0.1, 0.1), box(0.6, 0.6))).toBe(0)
  })

  it('is the shared area over the joined area', () => {
    // Two 0.2 squares shifted by half their width share 0.02 of 0.06.
    expect(overlap(box(0, 0), box(0.1, 0))).toBeCloseTo(1 / 3)
  })
})

describe('BoxSmoother', () => {
  it('gives the first box as it is', () => {
    expect(new BoxSmoother().smooth(box(0.3, 0.3))).toEqual(box(0.3, 0.3))
  })

  it('calms a box that shakes by moving only part of the way', () => {
    const smoother = new BoxSmoother(0.5)
    smoother.smooth(box(0.4, 0.4))

    const next = smoother.smooth(box(0.44, 0.4))

    expect(next?.x).toBeCloseTo(0.42)
  })

  it('follows an object that moves, getting closer every frame', () => {
    const smoother = new BoxSmoother(0.5)
    smoother.smooth(box(0.1, 0.4))
    let last = 0.1
    for (let frame = 0; frame < 6; frame++) {
      const x = smoother.smooth(box(0.2, 0.4))?.x ?? 0
      expect(x).toBeGreaterThan(last)
      last = x
    }

    expect(last).toBeGreaterThan(0.19)
  })

  it('takes a box far from the last one at once, so it never lags behind a jump', () => {
    const smoother = new BoxSmoother(0.5)
    smoother.smooth(box(0.05, 0.05))

    expect(smoother.smooth(box(0.7, 0.7))).toEqual(box(0.7, 0.7))
  })

  it('keeps the last box for a few frames when the model loses the object', () => {
    const smoother = new BoxSmoother(0.5, 2)
    smoother.smooth(box(0.4, 0.4))

    expect(smoother.smooth(null)).toEqual(box(0.4, 0.4))
    expect(smoother.smooth(null)).toEqual(box(0.4, 0.4))
    expect(smoother.smooth(null)).toBeNull()
  })

  it('starts again after it has been reset', () => {
    const smoother = new BoxSmoother()
    smoother.smooth(box(0.4, 0.4))
    smoother.reset()

    expect(smoother.smooth(null)).toBeNull()
  })
})
