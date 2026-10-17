import { describe, expect, it, vi } from 'vitest'
import { startDetectionLoop, type FrameSource, type PoseFrame } from './detectionLoop'
import { HandBudget, type HandsResultLike } from './handFrame'
import type { Landmark } from './landmarks'

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
        budget: new HandBudget(options.budgetMs ?? 33, 1)
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
