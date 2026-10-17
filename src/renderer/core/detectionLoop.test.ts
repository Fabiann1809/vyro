import { describe, expect, it, vi } from 'vitest'
import { startDetectionLoop, type FrameSource, type PoseFrame } from './detectionLoop'
import { FrameBudget } from './frameBudget'
import type { HandsResultLike } from './handFrame'
import type { Landmark } from './landmarks'
import { BoxSmoother, type ObjectsResultLike } from './objectFrame'

interface FakeSource {
  source: FrameSource
  emitFrame: () => void
  hasPending: () => boolean
}

// A fake video that only fires when the test says a new frame arrived.
function createFakeSource(): FakeSource {
  let pending: Parameters<FrameSource['requestVideoFrameCallback']>[0] | undefined
  let presented = 0
  let nextHandle = 0
  const source: FrameSource = {
    requestVideoFrameCallback: (callback) => {
      pending = callback
      return ++nextHandle
    },
    cancelVideoFrameCallback: vi.fn(() => {
      pending = undefined
    })
  }
  return {
    source,
    emitFrame: () => {
      const callback = pending
      pending = undefined
      callback?.(0, { presentedFrames: ++presented })
    },
    hasPending: () => pending !== undefined
  }
}

const point: Landmark = { x: 0.5, y: 0.5, z: 0, visibility: 1 }

describe('startDetectionLoop', () => {
  it('detects once per video frame and reports the first pose', () => {
    const { source, emitFrame } = createFakeSource()
    const detectForVideo = vi.fn(() => ({ landmarks: [[point, point], [point]] }))
    const frames: PoseFrame[] = []

    startDetectionLoop(
      source,
      { detectForVideo },
      { onFrame: (frame) => frames.push(frame), onError: vi.fn() }
    )
    emitFrame()
    emitFrame()

    expect(detectForVideo).toHaveBeenCalledTimes(2)
    expect(frames).toHaveLength(2)
    expect(frames[0]?.landmarks).toEqual([point, point])
  })

  it('reports null landmarks when nobody is in view', () => {
    const { source, emitFrame } = createFakeSource()
    const frames: PoseFrame[] = []

    startDetectionLoop(
      source,
      { detectForVideo: () => ({ landmarks: [] }) },
      { onFrame: (frame) => frames.push(frame), onError: vi.fn() }
    )
    emitFrame()

    expect(frames[0]?.landmarks).toBeNull()
  })

  it('keeps timestamps strictly increasing even if the clock does not move', () => {
    const { source, emitFrame } = createFakeSource()
    const timestamps: number[] = []

    startDetectionLoop(
      source,
      {
        detectForVideo: (_source, timestampMs) => {
          timestamps.push(timestampMs)
          return { landmarks: [] }
        }
      },
      { onFrame: vi.fn(), onError: vi.fn() },
      () => 100
    )
    emitFrame()
    emitFrame()
    emitFrame()

    expect(timestamps).toEqual([100, 101, 102])
  })

  it('measures how long each detection takes', () => {
    const { source, emitFrame } = createFakeSource()
    const readings = [10, 25]
    const frames: PoseFrame[] = []

    startDetectionLoop(
      source,
      { detectForVideo: () => ({ landmarks: [] }) },
      { onFrame: (frame) => frames.push(frame), onError: vi.fn() },
      () => readings.shift() ?? 0
    )
    emitFrame()

    expect(frames[0]?.latencyMs).toBe(15)
  })

  it('stops requesting frames once stopped', () => {
    const { source, emitFrame, hasPending } = createFakeSource()
    const detectForVideo = vi.fn(() => ({ landmarks: [] }))

    const stop = startDetectionLoop(
      source,
      { detectForVideo },
      { onFrame: vi.fn(), onError: vi.fn() }
    )
    emitFrame()
    stop()
    emitFrame()

    expect(detectForVideo).toHaveBeenCalledTimes(1)
    expect(hasPending()).toBe(false)
    expect(source.cancelVideoFrameCallback).toHaveBeenCalled()
  })

  it('reports a detector error and does not ask for more frames', () => {
    const { source, emitFrame, hasPending } = createFakeSource()
    const onError = vi.fn()
    const failure = new Error('model crashed')

    startDetectionLoop(
      source,
      {
        detectForVideo: () => {
          throw failure
        }
      },
      { onFrame: vi.fn(), onError }
    )
    emitFrame()

    expect(onError).toHaveBeenCalledWith(failure)
    expect(hasPending()).toBe(false)
  })
})

describe('startDetectionLoop frame metadata', () => {
  it('reports how many video frames the camera has presented', () => {
    const { source, emitFrame } = createFakeSource()
    const frames: PoseFrame[] = []

    startDetectionLoop(
      source,
      { detectForVideo: () => ({ landmarks: [] }) },
      { onFrame: (frame) => frames.push(frame), onError: vi.fn() }
    )
    emitFrame()
    emitFrame()

    expect(frames.map((frame) => frame.presentedFrames)).toEqual([1, 2])
  })
})

describe('startDetectionLoop with hands', () => {
  const twoHands: HandsResultLike = {
    landmarks: [[point], [point]],
    handedness: [[{ categoryName: 'Left', score: 1 }], [{ categoryName: 'Right', score: 1 }]]
  }

  function setup(options: { budgetMs?: number; times?: number[] } = {}): {
    emitFrame: () => void
    frames: PoseFrame[]
    detectHands: ReturnType<typeof vi.fn>
  } {
    const { source, emitFrame } = createFakeSource()
    const frames: PoseFrame[] = []
    const detectHands = vi.fn(() => twoHands)
    const times = [...(options.times ?? [])]
    let now = 0
    // Each reading of the clock moves it on, or follows the script of the test.
    const clock = (): number => times.shift() ?? (now += 1)
    startDetectionLoop(
      source,
      { detectForVideo: () => ({ landmarks: [[point]] }) },
      { onFrame: (frame) => frames.push(frame), onError: vi.fn() },
      clock,
      {
        detector: { detectForVideo: detectHands },
        budget: new FrameBudget(options.budgetMs ?? 33, 1)
      }
    )
    return { emitFrame, frames, detectHands }
  }

  it('reports both hands in every frame', () => {
    const { emitFrame, frames } = setup()

    emitFrame()

    expect(frames[0]?.hands?.observations.map((hand) => hand.handedness)).toEqual(['right', 'left'])
    expect(frames[0]?.hands?.fresh).toBe(true)
  })

  it('does not look for hands when nothing asked for them', () => {
    const { source, emitFrame } = createFakeSource()
    const frames: PoseFrame[] = []
    startDetectionLoop(
      source,
      { detectForVideo: () => ({ landmarks: [] }) },
      { onFrame: (frame) => frames.push(frame), onError: vi.fn() }
    )

    emitFrame()

    expect(frames[0]?.hands).toBeUndefined()
  })

  it('reuses the last hands when the body leaves no time, and says they are not fresh', () => {
    // Frame 1: body takes 1 ms, hands 40 ms. Frame 2: the body takes 10 ms and hands are known to be slow.
    const { emitFrame, frames, detectHands } = setup({
      times: [0, 1, 1, 41, 100, 110]
    })

    emitFrame()
    emitFrame()

    expect(detectHands).toHaveBeenCalledTimes(1)
    expect(frames[1]?.hands).toMatchObject({ fresh: false, latencyMs: 0 })
    expect(frames[1]?.hands?.observations).toHaveLength(2)
  })
})

describe('startDetectionLoop with an object', () => {
  // The model gives pixels of a 640x480 picture.
  const found = (originX: number, score = 0.9): ObjectsResultLike => ({
    detections: [
      {
        boundingBox: { originX, originY: 96, width: 128, height: 96 },
        categories: [{ categoryName: 'Guitar', score }]
      }
    ]
  })

  function setup(options: { times?: number[]; answers: ObjectsResultLike[] }): {
    emitFrame: () => void
    frames: PoseFrame[]
    detectObject: ReturnType<typeof vi.fn>
  } {
    const { source, emitFrame } = createFakeSource()
    const frames: PoseFrame[] = []
    const answers = [...options.answers]
    const detectObject = vi.fn(() => answers.shift() ?? { detections: [] })
    const times = [...(options.times ?? [])]
    let now = 0
    const clock = (): number => times.shift() ?? (now += 1)
    startDetectionLoop(
      source,
      { detectForVideo: () => ({ landmarks: [[point]] }) },
      { onFrame: (frame) => frames.push(frame), onError: vi.fn() },
      clock,
      undefined,
      {
        detector: { detectForVideo: detectObject },
        budget: new FrameBudget(33, 1),
        smoother: new BoxSmoother(0.5),
        sizeOf: () => ({ width: 640, height: 480 })
      }
    )
    return { emitFrame, frames, detectObject }
  }

  it('reports the box of the object in 0..1 of the picture', () => {
    const { emitFrame, frames } = setup({ answers: [found(320)] })

    emitFrame()

    expect(frames[0]?.objects).toMatchObject({
      box: { x: 0.5, y: 0.2, width: 0.2, height: 0.2 },
      fresh: true
    })
  })

  it('follows the object as it moves, frame after frame', () => {
    const { emitFrame, frames } = setup({ answers: [found(100), found(140), found(180)] })

    emitFrame()
    emitFrame()
    emitFrame()

    const xs = frames.map((frame) => frame.objects?.box?.x ?? 0)
    expect(xs[1]).toBeGreaterThan(xs[0] ?? 0)
    expect(xs[2]).toBeGreaterThan(xs[1] ?? 0)
    // It lags a little behind the raw box (180 px = 0.28) because it is smoothed.
    expect(xs[2]).toBeLessThan(180 / 640)
  })

  it('has no box when the model sees no object', () => {
    const { emitFrame, frames } = setup({ answers: [{ detections: [] }] })

    emitFrame()

    expect(frames[0]?.objects).toMatchObject({ box: null, fresh: true })
  })

  it('does not look for an object when nothing asked for it', () => {
    const { source, emitFrame } = createFakeSource()
    const frames: PoseFrame[] = []
    startDetectionLoop(
      source,
      { detectForVideo: () => ({ landmarks: [] }) },
      { onFrame: (frame) => frames.push(frame), onError: vi.fn() }
    )

    emitFrame()

    expect(frames[0]?.objects).toBeUndefined()
  })

  it('reuses the last box when the body leaves no time, and says it is not fresh', () => {
    // Frame 1: body 1 ms, object 40 ms. Frame 2: the body takes 10 ms and the object is known to be slow.
    const { emitFrame, frames, detectObject } = setup({
      times: [0, 1, 1, 41, 100, 110],
      answers: [found(320), found(500)]
    })

    emitFrame()
    emitFrame()

    expect(detectObject).toHaveBeenCalledTimes(1)
    expect(frames[1]?.objects).toMatchObject({ fresh: false, latencyMs: 0 })
    expect(frames[1]?.objects?.box?.x).toBe(frames[0]?.objects?.box?.x)
  })

  it('looks for hands and the object in the same frame', () => {
    const { source, emitFrame } = createFakeSource()
    const frames: PoseFrame[] = []
    startDetectionLoop(
      source,
      { detectForVideo: () => ({ landmarks: [[point]] }) },
      { onFrame: (frame) => frames.push(frame), onError: vi.fn() },
      undefined,
      {
        detector: {
          detectForVideo: () => ({
            landmarks: [[point]],
            handedness: [[{ categoryName: 'Left', score: 1 }]]
          })
        },
        budget: new FrameBudget()
      },
      {
        detector: { detectForVideo: () => found(320) },
        budget: new FrameBudget(),
        smoother: new BoxSmoother(),
        sizeOf: () => ({ width: 640, height: 480 })
      }
    )

    emitFrame()

    expect(frames[0]?.hands?.observations).toHaveLength(1)
    expect(frames[0]?.objects?.box).not.toBeNull()
  })
})
