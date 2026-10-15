import { describe, expect, it } from 'vitest'
import { FrameStats } from './frameStats'

// Feeds `count` frames spaced `intervalMs` apart, with the camera presenting every frame
// (or only every `presentEvery`-th one, to simulate a model slower than the camera).
function feed(
  stats: FrameStats,
  count: number,
  intervalMs: number,
  options: { latencyMs?: number; presentEvery?: number; startMs?: number } = {}
): void {
  const { latencyMs = 10, presentEvery = 1, startMs = 0 } = options
  for (let index = 0; index < count; index++) {
    stats.add({
      timestampMs: startMs + index * intervalMs,
      latencyMs,
      presentedFrames: index * presentEvery
    })
  }
}

describe('FrameStats', () => {
  it('reports zeros before it has two samples', () => {
    const stats = new FrameStats()

    expect(stats.snapshot(0)).toEqual({
      cameraFps: 0,
      detectionFps: 0,
      averageLatencyMs: 0,
      maxLatencyMs: 0
    })

    stats.add({ timestampMs: 0, latencyMs: 5, presentedFrames: 1 })
    expect(stats.snapshot(0).detectionFps).toBe(0)
  })

  it('measures 30 fps when every frame is processed', () => {
    const stats = new FrameStats()
    feed(stats, 31, 1000 / 30)

    const snapshot = stats.snapshot(1000)
    expect(snapshot.detectionFps).toBeCloseTo(30, 0)
    expect(snapshot.cameraFps).toBeCloseTo(30, 0)
  })

  it('shows the model as the bottleneck when frames are skipped', () => {
    const stats = new FrameStats()
    // The camera shows a frame every 33 ms, but the model only handles every second one.
    feed(stats, 16, 2000 / 30, { presentEvery: 2 })

    const snapshot = stats.snapshot(1000)
    expect(snapshot.cameraFps).toBeCloseTo(30, 0)
    expect(snapshot.detectionFps).toBeCloseTo(15, 0)
  })

  it('shows a slow camera when both rates are low', () => {
    const stats = new FrameStats()
    feed(stats, 16, 1000 / 15)

    const snapshot = stats.snapshot(1000)
    expect(snapshot.cameraFps).toBeCloseTo(15, 0)
    expect(snapshot.detectionFps).toBeCloseTo(15, 0)
  })

  it('averages latency and tracks the worst case', () => {
    const stats = new FrameStats()
    const latencies = [10, 20, 60]
    latencies.forEach((latencyMs, index) =>
      stats.add({ timestampMs: index * 33, latencyMs, presentedFrames: index })
    )

    const snapshot = stats.snapshot(100)
    expect(snapshot.averageLatencyMs).toBeCloseTo(30)
    expect(snapshot.maxLatencyMs).toBe(60)
  })

  it('only looks at the last second', () => {
    const stats = new FrameStats()
    feed(stats, 30, 1000 / 30, { latencyMs: 80 })
    feed(stats, 31, 1000 / 30, { latencyMs: 5, startMs: 5000 })

    expect(stats.snapshot(6000).maxLatencyMs).toBe(5)
  })

  it('decays to zero when the stream stalls', () => {
    const stats = new FrameStats()
    feed(stats, 31, 1000 / 30)

    expect(stats.snapshot(5000)).toEqual({
      cameraFps: 0,
      detectionFps: 0,
      averageLatencyMs: 0,
      maxLatencyMs: 0
    })
  })

  it('can be reset', () => {
    const stats = new FrameStats()
    feed(stats, 31, 1000 / 30)
    stats.reset()

    expect(stats.snapshot(1000).detectionFps).toBe(0)
  })
})
