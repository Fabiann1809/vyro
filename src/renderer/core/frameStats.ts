export interface FrameSample {
  timestampMs: number
  latencyMs: number
  presentedFrames: number
}

export interface FrameStatsSnapshot {
  // Frames per second the camera is delivering.
  cameraFps: number
  // Frames per second the pose model is actually processing.
  detectionFps: number
  averageLatencyMs: number
  maxLatencyMs: number
}

// Rolling statistics over the last second. If detectionFps is well below cameraFps the model is
// the bottleneck; if both are low the camera itself is slow (it often drops to 15 fps in dim light).
export class FrameStats {
  private samples: FrameSample[] = []

  constructor(private readonly windowMs: number = 1000) {}

  add(sample: FrameSample): void {
    this.samples.push(sample)
    this.dropOlderThan(sample.timestampMs - this.windowMs)
  }

  // `nowMs` lets a stalled stream decay to zero instead of freezing on its last values.
  snapshot(nowMs: number): FrameStatsSnapshot {
    this.dropOlderThan(nowMs - this.windowMs)

    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]
    if (!first || !last || this.samples.length < 2 || last.timestampMs <= first.timestampMs) {
      return { cameraFps: 0, detectionFps: 0, averageLatencyMs: 0, maxLatencyMs: 0 }
    }

    const seconds = (last.timestampMs - first.timestampMs) / 1000
    const latencies = this.samples.map((sample) => sample.latencyMs)

    return {
      cameraFps: (last.presentedFrames - first.presentedFrames) / seconds,
      detectionFps: (this.samples.length - 1) / seconds,
      averageLatencyMs: latencies.reduce((sum, value) => sum + value, 0) / latencies.length,
      maxLatencyMs: Math.max(...latencies)
    }
  }

  reset(): void {
    this.samples = []
  }

  private dropOlderThan(limitMs: number): void {
    const firstKept = this.samples.findIndex((sample) => sample.timestampMs >= limitMs)
    this.samples = firstKept === -1 ? [] : this.samples.slice(firstKept)
  }
}
