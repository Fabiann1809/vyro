import type { CheckState } from '../framing'

export type AudioInstruction =
  'waitForMicrophone' | 'measuringRoom' | 'quietRoom' | 'makeSound' | 'louder' | 'tooLoud'

export interface AudioFramingReport {
  noise: CheckState
  sound: CheckState
  // The one thing to fix first; null when everything is right.
  instruction: AudioInstruction | null
}

export interface AudioFramingOptions {
  // How long the room is listened to, in silence, before its noise is judged.
  roomMs: number
  // The noisiest the room may be, in dBFS.
  maxNoiseDb: number
  // The sound must be at least this loud, and this much louder than the room.
  minSoundDb: number
  minRiseDb: number
  // Anything between this and the minimum is "a bit louder, please"; below it is nothing at all.
  silenceDb: number
  // A sample this close to full scale is cut off.
  maxPeak: number
}

export const DEFAULT_AUDIO_FRAMING: AudioFramingOptions = {
  roomMs: 1500,
  maxNoiseDb: -45,
  minSoundDb: -40,
  minRiseDb: 12,
  silenceDb: -55,
  maxPeak: 0.98
}

const middleOf = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? -100
}

// Checks the sound of the place before a skill that listens starts: first the person stays quiet
// for a moment and the noise of the room is measured; then they play, and the sound must stand out
// from the room and neither be too weak nor cut off. Once a good sound has been heard it counts
// for good, since a note dies away and the check would otherwise flicker.
export class AudioFraming {
  private roomStartMs: number | null = null
  private roomLevels: number[] = []
  private noiseDb: number | null = null
  private noisy = false
  private soundHeard = false
  private strongest = -100
  private clipped = false

  constructor(private readonly options: AudioFramingOptions = DEFAULT_AUDIO_FRAMING) {}

  // Feeds one reading of the sound. `peak` is the largest sample, 0..1.
  update(timestampMs: number, levelDb: number, peak: number): AudioFramingReport {
    if (this.noiseDb === null) return this.measureRoom(timestampMs, levelDb)
    return this.listenForSound(levelDb, peak)
  }

  // For the screen, before the first reading arrives.
  waiting(): AudioFramingReport {
    return { noise: 'pending', sound: 'pending', instruction: 'waitForMicrophone' }
  }

  reset(): void {
    this.roomStartMs = null
    this.roomLevels = []
    this.noiseDb = null
    this.noisy = false
    this.soundHeard = false
    this.strongest = -100
    this.clipped = false
  }

  private measureRoom(timestampMs: number, levelDb: number): AudioFramingReport {
    this.roomStartMs ??= timestampMs
    this.roomLevels.push(levelDb)

    if (timestampMs - this.roomStartMs < this.options.roomMs) {
      // While it listens again, the room is still the noisy one it was.
      return this.noisy
        ? { noise: 'fix', sound: 'pending', instruction: 'quietRoom' }
        : { noise: 'pending', sound: 'pending', instruction: 'measuringRoom' }
    }

    const noise = middleOf(this.roomLevels)
    if (noise > this.options.maxNoiseDb) {
      // Too noisy: listen again from now, in case the noise was a passing one.
      this.noisy = true
      this.roomStartMs = timestampMs
      this.roomLevels = []
      return { noise: 'fix', sound: 'pending', instruction: 'quietRoom' }
    }
    this.noisy = false
    this.noiseDb = noise
    return { noise: 'ok', sound: 'pending', instruction: 'makeSound' }
  }

  private listenForSound(levelDb: number, peak: number): AudioFramingReport {
    const { minSoundDb, minRiseDb, silenceDb, maxPeak } = this.options
    const noise = this.noiseDb ?? -100

    this.strongest = Math.max(this.strongest, levelDb)
    this.clipped = this.clipped || peak >= maxPeak
    if (!this.soundHeard && levelDb >= minSoundDb && levelDb - noise >= minRiseDb) {
      this.soundHeard = peak < maxPeak
    }

    if (this.soundHeard) return { noise: 'ok', sound: 'ok', instruction: null }
    if (peak >= maxPeak) return { noise: 'ok', sound: 'fix', instruction: 'tooLoud' }
    return {
      noise: 'ok',
      sound: this.strongest < silenceDb ? 'pending' : 'fix',
      instruction: this.strongest < silenceDb ? 'makeSound' : 'louder'
    }
  }

  get roomIsNoisy(): boolean {
    return this.noisy
  }
}
