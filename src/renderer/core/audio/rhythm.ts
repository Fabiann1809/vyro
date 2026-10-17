// When notes start and how fast they come, from the loudness over time. It works on the level that
// the capture already measures, so it needs no sound at all.

export interface OnsetOptions {
  // How much louder than the sound just before a reading must be to count as a new note, in dB.
  riseDb: number
  // Quieter than this is never a note, however much it rises: it is the noise of the room.
  floorDb: number
  // Two notes closer than this are one (a note rings, and a reading may rise twice).
  minGapMs: number
  // How many readings before this one are the "sound just before".
  lookBack: number
}

export const DEFAULT_ONSETS: OnsetOptions = { riseDb: 8, floorDb: -50, minGapMs: 120, lookBack: 3 }

// Finds the moments at which a new note starts: the level jumps well above what it was a moment ago.
export class OnsetDetector {
  private readonly recent: number[] = []
  private lastOnsetMs = -Infinity

  constructor(private readonly options: OnsetOptions = DEFAULT_ONSETS) {}

  // Feeds one reading; returns the time of the note when it starts in this reading.
  update(timestampMs: number, levelDb: number): number | null {
    const { riseDb, floorDb, minGapMs, lookBack } = this.options
    const before =
      this.recent.length === 0
        ? null
        : this.recent.reduce((sum, value) => sum + value, 0) / this.recent.length

    this.recent.push(levelDb)
    if (this.recent.length > lookBack) this.recent.shift()

    const rises = before !== null && levelDb - before >= riseDb && levelDb > floorDb
    if (!rises || timestampMs - this.lastOnsetMs < minGapMs) return null

    this.lastOnsetMs = timestampMs
    return timestampMs
  }

  reset(): void {
    this.recent.length = 0
    this.lastOnsetMs = -Infinity
  }
}

const MIN_BPM = 30
const MAX_BPM = 240

// A gap within this fraction of the usual one is a gap between neighbouring beats; a longer one is
// a note that was skipped, and a shorter one is a note that came twice.
const GAP_TOLERANCE = 0.25

function middleOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

// The beats per minute of a series of notes. The usual gap is the middle one, which ignores a note
// that came early or late; then the gaps close to it are averaged, so that the small error in the
// time of each note (a reading is every 33 ms) does not add up to a wrong pace. It needs three notes
// at least, and gives null when the pace is not one that music has.
export function estimateBpm(onsetsMs: readonly number[]): number | null {
  const gaps = onsetsMs.slice(1).map((time, index) => time - (onsetsMs[index] ?? 0))
  if (gaps.length < 2) return null

  const usual = middleOf(gaps)
  if (usual <= 0) return null
  const neighbours = gaps.filter((gap) => Math.abs(gap - usual) <= usual * GAP_TOLERANCE)
  const gap = neighbours.reduce((sum, value) => sum + value, 0) / neighbours.length

  const bpm = 60_000 / gap
  return bpm >= MIN_BPM && bpm <= MAX_BPM ? bpm : null
}

// How far a note was from the beat it should have been on, in milliseconds: positive when late.
// `beatMs` is the length of one beat and `startMs` the moment of a beat to count from.
export function offBeatMs(onsetMs: number, startMs: number, beatMs: number): number {
  const beats = (onsetMs - startMs) / beatMs
  return (beats - Math.round(beats)) * beatMs
}
