// The model that tells instruments apart listens to windows of this many seconds (YAMNet).
export const WINDOW_SECONDS = 0.975

// Keeps the last second or so of sound, in memory, so that the instrument can be classified. It is
// overwritten as new sound comes in and never leaves the classifier that owns it.
export class SoundWindow {
  private buffer = new Float32Array(0)
  private filled = 0
  private rate = 0

  // Adds sound that follows what was added before, without gaps.
  push(samples: Float32Array, sampleRate: number): void {
    const size = Math.ceil(WINDOW_SECONDS * sampleRate)
    if (sampleRate !== this.rate) {
      this.rate = sampleRate
      this.buffer = new Float32Array(size)
      this.filled = 0
    }

    const kept = samples.length >= size ? samples.subarray(samples.length - size) : samples
    this.buffer.copyWithin(0, kept.length)
    this.buffer.set(kept, size - kept.length)
    this.filled = Math.min(size, this.filled + kept.length)
  }

  get full(): boolean {
    return this.rate > 0 && this.filled >= this.buffer.length
  }

  // The last window, oldest sound first; null until a whole window has been heard.
  latest(): Float32Array | null {
    return this.full ? this.buffer.slice() : null
  }

  reset(): void {
    this.filled = 0
  }
}
