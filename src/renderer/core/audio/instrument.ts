import { INSTRUMENT_CLASSES, INSTRUMENTS, type InstrumentName } from '@shared/skill/instruments'

// One answer of the audio model for a window of about a second: the classes it thinks it heard.
export interface HeardClass {
  name: string
  score: number
}

// How likely each instrument is, 0..1.
export type InstrumentScores = Record<InstrumentName, number>

const none = (): InstrumentScores =>
  Object.fromEntries(INSTRUMENTS.map((instrument) => [instrument, 0])) as InstrumentScores

// The score of an instrument is that of its most likely class: the model scores every class on its
// own (they do not add up to one), so "Guitar" and "Acoustic guitar" are two ways to say guitar.
export function scoreInstruments(heard: readonly HeardClass[]): InstrumentScores {
  const scores = none()
  for (const instrument of INSTRUMENTS) {
    const names: readonly string[] = INSTRUMENT_CLASSES[instrument]
    for (const item of heard) {
      if (names.includes(item.name)) scores[instrument] = Math.max(scores[instrument], item.score)
    }
  }
  return scores
}

export interface InstrumentOptions {
  // How long a change takes to show, in milliseconds. A bigger value flickers less and answers later.
  smoothingMs: number
  // An instrument counts as heard from this smoothed score; it stops counting below `leaveAt`, so a
  // score that hovers around the limit does not switch on and off.
  heardAt: number
  leaveAt: number
}

export const DEFAULT_INSTRUMENT_OPTIONS: InstrumentOptions = {
  smoothingMs: 1500,
  heardAt: 0.4,
  leaveAt: 0.25
}

export interface InstrumentReading {
  scores: InstrumentScores
  // The most likely instrument if one is heard, or null when there is none (silence, noise, a sound
  // the model does not know).
  heard: InstrumentName | null
}

// Turns the answers of the model, one for each window of sound, into a steady reading: scores that
// move smoothly and one instrument that is heard or none.
export class InstrumentTracker {
  private scores = none()
  private heard: InstrumentName | null = null
  private lastMs: number | null = null

  constructor(private readonly options: InstrumentOptions = DEFAULT_INSTRUMENT_OPTIONS) {}

  update(timestampMs: number, windowClasses: readonly HeardClass[]): InstrumentReading {
    const latest = scoreInstruments(windowClasses)
    // The longer since the last answer, the more weight the new one has.
    const elapsed = this.lastMs === null ? Infinity : Math.max(0, timestampMs - this.lastMs)
    const weight = 1 - Math.exp(-elapsed / this.options.smoothingMs)
    this.lastMs = timestampMs

    for (const instrument of INSTRUMENTS) {
      this.scores[instrument] += (latest[instrument] - this.scores[instrument]) * weight
    }
    this.heard = this.pickHeard()
    return { scores: { ...this.scores }, heard: this.heard }
  }

  // The instrument that was heard keeps counting until it falls below the lower limit, unless
  // another one scores higher.
  private pickHeard(): InstrumentName | null {
    const best = INSTRUMENTS.reduce((top, instrument) =>
      this.scores[instrument] > this.scores[top] ? instrument : top
    )
    const current = this.heard
    if (current !== null && this.scores[current] >= this.options.leaveAt) {
      const overtaken = this.scores[best] >= this.options.heardAt && best !== current
      return overtaken && this.scores[best] > this.scores[current] ? best : current
    }
    return this.scores[best] >= this.options.heardAt ? best : null
  }
}
