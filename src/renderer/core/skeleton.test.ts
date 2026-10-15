import { describe, expect, it, vi } from 'vitest'
import { POSE_LANDMARK, POSE_LANDMARK_COUNT, type Landmark } from './landmarks'
import { drawSkeleton, SKELETON_CONNECTIONS } from './skeleton'

function fakeContext(): {
  ctx: CanvasRenderingContext2D
  calls: Record<string, ReturnType<typeof vi.fn>>
} {
  const calls = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn()
  }
  return { ctx: calls as unknown as CanvasRenderingContext2D, calls }
}

function pose(visibility: number): Landmark[] {
  return Array.from({ length: POSE_LANDMARK_COUNT }, (_, index) => ({
    x: index / POSE_LANDMARK_COUNT,
    y: 0.5,
    z: 0,
    visibility
  }))
}

describe('drawSkeleton', () => {
  it('only clears the canvas when nobody is in view', () => {
    const { ctx, calls } = fakeContext()

    drawSkeleton(ctx, null, 640, 480)

    expect(calls.clearRect).toHaveBeenCalledWith(0, 0, 640, 480)
    expect(calls.stroke).not.toHaveBeenCalled()
    expect(calls.fill).not.toHaveBeenCalled()
  })

  it('draws every connection when the whole body is visible', () => {
    const { ctx, calls } = fakeContext()

    drawSkeleton(ctx, pose(0.9), 640, 480)

    expect(calls.stroke).toHaveBeenCalledTimes(SKELETON_CONNECTIONS.length)
  })

  it('skips connections that touch a hidden point', () => {
    const { ctx, calls } = fakeContext()
    const landmarks = pose(0.9)
    landmarks[POSE_LANDMARK.LEFT_KNEE] = { x: 0.5, y: 0.5, z: 0, visibility: 0.1 }

    drawSkeleton(ctx, landmarks, 640, 480)

    // Left knee is part of two connections (hip-knee and knee-ankle).
    expect(calls.stroke).toHaveBeenCalledTimes(SKELETON_CONNECTIONS.length - 2)
  })

  it('draws nothing when no point is visible enough', () => {
    const { ctx, calls } = fakeContext()

    drawSkeleton(ctx, pose(0.2), 640, 480)

    expect(calls.stroke).not.toHaveBeenCalled()
    expect(calls.arc).not.toHaveBeenCalled()
  })

  it('scales normalized coordinates to the canvas size', () => {
    const { ctx, calls } = fakeContext()
    const landmarks = pose(0.9)
    landmarks[POSE_LANDMARK.LEFT_SHOULDER] = { x: 0.25, y: 0.5, z: 0, visibility: 0.9 }
    landmarks[POSE_LANDMARK.RIGHT_SHOULDER] = { x: 0.75, y: 0.5, z: 0, visibility: 0.9 }

    drawSkeleton(ctx, landmarks, 1000, 400)

    expect(calls.moveTo).toHaveBeenCalledWith(250, 200)
    expect(calls.lineTo).toHaveBeenCalledWith(750, 200)
  })

  it('uses only valid landmark indices', () => {
    for (const [from, to] of SKELETON_CONNECTIONS) {
      expect(from).toBeLessThan(POSE_LANDMARK_COUNT)
      expect(to).toBeLessThan(POSE_LANDMARK_COUNT)
    }
  })
})
