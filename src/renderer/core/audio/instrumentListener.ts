import {
  InstrumentTracker,
  type HeardClass,
  type InstrumentOptions,
  type InstrumentReading
} from './instrument'
import { SoundWindow } from './soundWindow'

// Asks the audio model what a window of sound is; it answers with the classes it recognised.
export type ClassifyWindow = (samples: Float32Array, sampleRate: number) => HeardClass[]

// What the capture hands the sound to: it learns which instrument is playing.
export interface SoundListener {
  // Sound that follows what was pushed before. Returns the latest reading, or null while a first
  // window has not been classified yet.
  push(samples: Float32Array, sampleRate: number, nowMs: number): InstrumentReading | null
}

// How often a window is classified: the model needs a few milliseconds, so not at every reading.
const CLASSIFY_EVERY_MS = 500

// Collects the sound, asks the model about the last second every so often and smooths the answers.
export class InstrumentListener implements SoundListener {
  private readonly window = new SoundWindow()
  private readonly tracker: InstrumentTracker
  private reading: InstrumentReading | null = null
  private lastRunMs = -Infinity

  constructor(
    private readonly classify: ClassifyWindow,
    options?: InstrumentOptions
  ) {
    this.tracker = new InstrumentTracker(options)
  }

  push(samples: Float32Array, sampleRate: number, nowMs: number): InstrumentReading | null {
    this.window.push(samples, sampleRate)
    if (nowMs - this.lastRunMs < CLASSIFY_EVERY_MS) return this.reading

    const heard = this.window.latest()
    if (heard === null) return this.reading
    this.lastRunMs = nowMs
    this.reading = this.tracker.update(nowMs, this.classify(heard, sampleRate))
    return this.reading
  }
}
