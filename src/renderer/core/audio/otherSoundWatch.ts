// A reading is never worth more than this: after a gap (the tab was asleep) the sound that came
// before must not count as if it had gone on all that time.
const MAX_STEP_MS = 100

// Tells when sound that is not the instrument asked for has been heard for a while. It adds up the
// time of that sound, not the time that passed: a player rests between notes, and a short wait
// first lets the model recognise the first notes. The instrument being heard starts it over.
export class OtherSoundWatch {
  private heardMs = 0
  private lastMs: number | null = null

  constructor(
    private readonly waitMs: number,
    private readonly silenceDb: number
  ) {}

  // `heard` says whether the instrument is sounding (null: it is not being classified).
  update(timestampMs: number, levelDb: number, heard: boolean | null): boolean {
    const step = this.lastMs === null ? 0 : Math.min(MAX_STEP_MS, timestampMs - this.lastMs)
    this.lastMs = timestampMs

    if (heard !== false) {
      this.heardMs = 0
    } else if (levelDb >= this.silenceDb) {
      this.heardMs += step
    }
    return this.heardMs >= this.waitMs
  }

  reset(): void {
    this.heardMs = 0
    this.lastMs = null
  }
}
