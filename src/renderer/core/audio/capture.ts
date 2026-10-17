import { levelDb, peakLevel } from './level'
import { detectPitch } from './pitch'

// What the rest of the app learns about the sound: numbers, and nothing else. The sound itself
// (the samples) never leaves this file: it is read into one buffer, measured, and overwritten by the
// next reading. There is no recording, no copy, no way to get the samples out, and nothing here is
// ever stored or sent.
export interface AudioFeatures {
  // Loudness, in dBFS.
  levelDb: number
  // The largest sample, 0..1.
  peak: number
  // The pitch in hertz, or 0 when the sound has none (silence, noise).
  pitchHz: number
  // How sure the pitch is, 0..1; 0 when there is none.
  pitchClarity: number
}

// Turns the samples of one reading into numbers. It receives a buffer that is reused, so it must not
// keep it.
export type FeatureExtractor = (samples: Float32Array, sampleRate: number) => AudioFeatures

// Only how loud it is: cheap, for a meter.
export const measureLevel: FeatureExtractor = (samples) => ({
  levelDb: levelDb(samples),
  peak: peakLevel(samples),
  pitchHz: 0,
  pitchClarity: 0
})

// How loud it is and which note: for the skills that listen to an instrument.
export const measureSound: FeatureExtractor = (samples, sampleRate) => {
  const pitch = detectPitch(samples, sampleRate)
  return {
    levelDb: levelDb(samples),
    peak: peakLevel(samples),
    pitchHz: pitch?.frequency ?? 0,
    pitchClarity: pitch?.clarity ?? 0
  }
}

// The few parts of the Web Audio API that are used, so that they can be faked in tests.
export type AudioContextLike = Pick<
  AudioContext,
  'sampleRate' | 'createMediaStreamSource' | 'createAnalyser' | 'resume' | 'close'
>

export interface CaptureDeps {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  createContext: () => AudioContextLike
  // Calls `read` again and again until the returned function is called.
  every: (read: () => void) => () => void
}

// Samples per reading: about 43 ms at 48 kHz, enough for the lowest notes of a guitar.
const WINDOW_SAMPLES = 2048

// Raw sound: the filters that make a voice call pleasant would bend the pitch and the volume.
export function buildMicrophoneConstraints(deviceId?: string): MediaStreamConstraints {
  return {
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    },
    video: false
  }
}

export function browserCaptureDeps(): CaptureDeps {
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createContext: () => new AudioContext(),
    every: (read) => {
      const timer = setInterval(read, 33)
      return () => clearInterval(timer)
    }
  }
}

// Listens to the microphone and reports numbers about the sound, about thirty times a second. It is
// only connected to the analyser: nothing is played back and nothing is recorded.
export class AudioCapture {
  // Real private fields, not only a promise of the type checker: nothing can reach the stream from
  // outside, not even by looking inside the object.
  readonly #stream: MediaStream
  readonly #context: AudioContextLike
  readonly #stopReading: () => void

  private constructor(stream: MediaStream, context: AudioContextLike, stopReading: () => void) {
    this.#stream = stream
    this.#context = context
    this.#stopReading = stopReading
  }

  static async open(
    onFeatures: (features: AudioFeatures) => void,
    options: {
      deviceId?: string
      extract?: FeatureExtractor
      deps?: CaptureDeps
    } = {}
  ): Promise<AudioCapture> {
    const { deviceId, extract = measureLevel, deps = browserCaptureDeps() } = options
    const stream = await deps.getUserMedia(buildMicrophoneConstraints(deviceId))
    const context = deps.createContext()
    try {
      await context.resume()
      const analyser = context.createAnalyser()
      analyser.fftSize = WINDOW_SAMPLES
      context.createMediaStreamSource(stream).connect(analyser)

      // The only buffer there is, read over and over.
      const samples = new Float32Array(WINDOW_SAMPLES)
      const stopReading = deps.every(() => {
        analyser.getFloatTimeDomainData(samples)
        onFeatures(extract(samples, context.sampleRate))
      })
      return new AudioCapture(stream, context, stopReading)
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop())
      void context.close()
      throw error
    }
  }

  // Stops listening and lets go of the microphone.
  close(): void {
    this.#stopReading()
    this.#stream.getTracks().forEach((track) => track.stop())
    void this.#context.close()
  }
}
