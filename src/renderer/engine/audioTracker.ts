import type { AudioFeatures } from '@renderer/core/audio/capture'
import { centsBetween } from '@renderer/core/audio/pitch'
import { estimateBpm, OnsetDetector } from '@renderer/core/audio/rhythm'

// What the engine knows about the sound at one moment.
export interface AudioState {
  // How loud, in dBFS.
  levelDb: number
  // The pitch heard now, in hertz; 0 when there is none or it is not sure.
  pitchHz: number
  // The pitch of the note being played, and of the one before it; 0 when unknown.
  noteHz: number
  previousNoteHz: number
  // Beats per minute of the last notes; null while there are too few.
  bpm: number | null
}

// A reading with less clarity than this is not taken as a pitch.
const MIN_CLARITY = 0.85
// A pitch within this many cents of the note being played is the same note.
const SAME_NOTE_CENTS = 60
// A pitch must hold this many readings before it counts as a new note.
const READINGS_FOR_NOTE = 3
// This many readings without a pitch end the note.
const READINGS_TO_END = 4
// Notes further apart than this are not one phrase: the pace starts over.
const MAX_NOTE_GAP_MS = 3000
const NOTES_FOR_PACE = 8

function middleOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

// Turns the readings of the sound, one after another, into notes and a pace. It keeps numbers only.
export class AudioTracker {
  private readonly onsets = new OnsetDetector()
  private onsetTimes: number[] = []
  private current: number[] = []
  private candidate: number[] = []
  private previous = 0
  private quietReadings = 0

  update(timestampMs: number, features: AudioFeatures): AudioState {
    const pitchHz = features.pitchClarity >= MIN_CLARITY ? features.pitchHz : 0
    this.trackPace(timestampMs, features.levelDb)
    this.trackNote(pitchHz)

    return {
      levelDb: features.levelDb,
      pitchHz,
      noteHz: this.current.length > 0 ? middleOf(this.current) : 0,
      previousNoteHz: this.previous,
      bpm: estimateBpm(this.onsetTimes)
    }
  }

  reset(): void {
    this.onsets.reset()
    this.onsetTimes = []
    this.current = []
    this.candidate = []
    this.previous = 0
    this.quietReadings = 0
  }

  private trackPace(timestampMs: number, levelDb: number): void {
    const onset = this.onsets.update(timestampMs, levelDb)
    if (onset === null) return
    const last = this.onsetTimes[this.onsetTimes.length - 1]
    if (last !== undefined && onset - last > MAX_NOTE_GAP_MS) this.onsetTimes = []
    this.onsetTimes = [...this.onsetTimes, onset].slice(-NOTES_FOR_PACE)
  }

  private trackNote(pitchHz: number): void {
    if (pitchHz === 0) {
      this.candidate = []
      this.quietReadings++
      if (this.quietReadings >= READINGS_TO_END && this.current.length > 0) {
        this.previous = middleOf(this.current)
        this.current = []
      }
      return
    }
    this.quietReadings = 0

    const note = this.current.length > 0 ? middleOf(this.current) : 0
    if (note > 0 && Math.abs(centsBetween(pitchHz, note)) <= SAME_NOTE_CENTS) {
      this.current.push(pitchHz)
      this.candidate = []
      return
    }

    // A pitch far from the note being played: a new note once it holds for a few readings.
    const candidate = this.candidate.length > 0 ? middleOf(this.candidate) : 0
    this.candidate =
      candidate > 0 && Math.abs(centsBetween(pitchHz, candidate)) <= SAME_NOTE_CENTS
        ? [...this.candidate, pitchHz]
        : [pitchHz]
    if (this.candidate.length >= READINGS_FOR_NOTE || note === 0) {
      if (note > 0) this.previous = note
      this.current = this.candidate
      this.candidate = []
    }
  }
}
