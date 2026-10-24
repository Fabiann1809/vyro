// What the tuner says about a note that sounds, against the note the person is tuning to.

// Within this many cents the string counts as in tune.
export const IN_TUNE_CENTS = 5
// The string must stay in tune this long: a pitch that crosses the note on its way is not tuned.
export const IN_TUNE_HOLD_MS = 1000
// Further than this from the note, the person is most likely playing another string.
export const OTHER_STRING_CENTS = 150
// A reading with no clear note for less than this does not break the time in tune: a string wavers
// for a moment now and then while it rings.
export const DROPOUT_MS = 300

export type TuningStatus = 'silent' | 'flat' | 'sharp' | 'inTune' | 'otherString'

// `cents` is how far the sound is from the wanted note (positive when higher); null when no note
// is clear.
export function tuningStatus(cents: number | null): TuningStatus {
  if (cents === null) return 'silent'
  if (Math.abs(cents) > OTHER_STRING_CENTS) return 'otherString'
  if (cents < -IN_TUNE_CENTS) return 'flat'
  if (cents > IN_TUNE_CENTS) return 'sharp'
  return 'inTune'
}

// Says when the sound has been in tune for long enough. Feed it every reading; it returns true once
// per time it is reached, and starts counting again after any reading out of tune.
export class InTuneHold {
  private since: number | null = null
  private lastInTune = 0
  private reached = false

  constructor(private readonly holdMs = IN_TUNE_HOLD_MS) {}

  // The share of the hold that has gone by, 0..1, for a bar that fills.
  progress(timestampMs: number): number {
    return this.since === null ? 0 : Math.min(1, (timestampMs - this.since) / this.holdMs)
  }

  update(timestampMs: number, cents: number | null): boolean {
    if (tuningStatus(cents) !== 'inTune') {
      const dropout = cents === null && timestampMs - this.lastInTune <= DROPOUT_MS
      if (!dropout) this.reset()
      return false
    }
    this.lastInTune = timestampMs
    this.since ??= timestampMs
    if (this.reached || timestampMs - this.since < this.holdMs) return false
    this.reached = true
    return true
  }

  reset(): void {
    this.since = null
    this.lastInTune = 0
    this.reached = false
  }
}

// The next string still to tune after `current`, going round to the start; null when all are done.
export function nextUntuned(
  current: number,
  tuned: ReadonlySet<number>,
  total: number
): number | null {
  for (let step = 1; step <= total; step++) {
    const index = (current + step) % total
    if (!tuned.has(index)) return index
  }
  return null
}
