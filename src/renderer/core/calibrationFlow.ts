export type CalibrationState =
  { phase: 'checking' } | { phase: 'countdown'; remaining: number } | { phase: 'done' }

export interface CalibrationOptions {
  // How long everything must be right before the countdown starts.
  holdMs: number
  steps: number
  stepMs: number
  // A short slip (a lost frame, a blink of the model) does not cancel the countdown.
  graceMs: number
}

export const DEFAULT_CALIBRATION: CalibrationOptions = {
  holdMs: 800,
  steps: 3,
  stepMs: 1000,
  graceMs: 500
}

// Turns "is the framing right now?" into the start of a 3-2-1 countdown, and cancels it when the
// person moves out of place for longer than the grace period.
export class CalibrationFlow {
  private okSince: number | null = null
  private lastOkAt = 0
  private countdownStart: number | null = null
  private finished = false

  constructor(private readonly options: CalibrationOptions = DEFAULT_CALIBRATION) {}

  update(framingOk: boolean, nowMs: number): CalibrationState {
    if (this.finished) return { phase: 'done' }

    if (framingOk) {
      this.lastOkAt = nowMs
      this.okSince ??= nowMs
    } else if (this.okSince === null || nowMs - this.lastOkAt > this.options.graceMs) {
      this.okSince = null
      this.countdownStart = null
    }

    if (this.okSince !== null && this.countdownStart === null) {
      if (nowMs - this.okSince >= this.options.holdMs) this.countdownStart = nowMs
    }

    if (this.countdownStart === null) return { phase: 'checking' }

    const { steps, stepMs } = this.options
    const elapsed = nowMs - this.countdownStart
    if (elapsed >= steps * stepMs) {
      this.finished = true
      return { phase: 'done' }
    }
    return { phase: 'countdown', remaining: steps - Math.floor(elapsed / stepMs) }
  }

  reset(): void {
    this.okSince = null
    this.countdownStart = null
    this.finished = false
  }
}
