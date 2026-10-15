import type { MetricValues } from './metrics'
import { PhaseDetector } from './phaseDetector'
import type { SkillConfig } from './skillSchema'

export interface RepSample {
  timestampMs: number
  values: MetricValues
}

export interface PhaseStep {
  phase: string
  timestampMs: number
}

export interface CompletedRep {
  // 1 for the first valid repetition of the session, then 2, 3...
  index: number
  // Last moment the body was still at the starting phase, and the moment it came back to it.
  startMs: number
  endMs: number
  durationMs: number
  // When each phase of the sequence was reached.
  steps: PhaseStep[]
  // Every frame between startMs and endMs, for the rules to look at.
  samples: RepSample[]
}

export type RepEvent =
  | { type: 'completed'; rep: CompletedRep }
  // The sequence was completed, but faster than the skill allows: a glitch, not a real repetition.
  | { type: 'rejected'; reason: 'too-fast'; durationMs: number }

export interface RepCounterOptions {
  // A repetition that lasts for more frames than this is dropped (the user wandered off).
  maxSamples: number
}

// About a minute at 30 fps.
const DEFAULT_OPTIONS: RepCounterOptions = { maxSamples: 1800 }

// Follows the phases of the body and reports each repetition that goes through the whole
// sequence of the skill (for example up, down, up). Half repetitions are ignored.
export class RepCounter {
  private readonly detector: PhaseDetector
  private readonly sequence: readonly string[]
  private readonly minDurationMs: number
  private readonly options: RepCounterOptions

  // How many steps of the sequence the current attempt has gone through. 0 = not started.
  private progress = 0
  private startMs = 0
  private steps: PhaseStep[] = []
  private samples: RepSample[] = []
  private completed = 0

  constructor(skill: SkillConfig, options: Partial<RepCounterOptions> = {}) {
    this.detector = new PhaseDetector(skill)
    this.sequence = skill.rep.sequence
    this.minDurationMs = skill.rep.minDurationMs
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  get count(): number {
    return this.completed
  }

  update(timestampMs: number, values: MetricValues): RepEvent | null {
    const sample: RepSample = { timestampMs, values }
    const change = this.detector.update(values)

    if (change.changed && change.phase !== null) return this.onPhaseChange(change.phase, sample)

    this.onSamePhase(sample)
    return null
  }

  // Call when the person leaves the frame or the camera changes: the attempt in progress is lost.
  reset(): void {
    this.detector.reset()
    this.abandon()
  }

  private onPhaseChange(phase: string, sample: RepSample): RepEvent | null {
    if (this.progress === 0) {
      if (phase === this.sequence[0]) this.begin(sample)
      return null
    }

    if (phase !== this.sequence[this.progress]) {
      // Not the step we were waiting for: this attempt is over, but it may start a new one.
      this.abandon()
      if (phase === this.sequence[0]) this.begin(sample)
      return null
    }

    this.progress++
    this.steps.push({ phase, timestampMs: sample.timestampMs })
    this.samples.push(sample)

    return this.progress === this.sequence.length ? this.finish(sample) : null
  }

  private onSamePhase(sample: RepSample): void {
    if (this.progress === 0) return

    // While still at the starting phase the repetition has not really begun: keep moving its
    // start forward until the body leaves it.
    const start = this.sequence[0]
    if (this.progress === 1 && start && this.detector.isIn(start, sample.values)) {
      this.begin(sample)
      return
    }

    this.samples.push(sample)
    if (this.samples.length > this.options.maxSamples) this.abandon()
  }

  private begin(sample: RepSample): void {
    this.progress = 1
    this.startMs = sample.timestampMs
    this.steps = [{ phase: this.sequence[0] ?? '', timestampMs: sample.timestampMs }]
    this.samples = [sample]
  }

  private abandon(): void {
    this.progress = 0
    this.steps = []
    this.samples = []
  }

  private finish(last: RepSample): RepEvent {
    const durationMs = last.timestampMs - this.startMs

    const event: RepEvent =
      durationMs >= this.minDurationMs
        ? {
            type: 'completed',
            rep: {
              index: ++this.completed,
              startMs: this.startMs,
              endMs: last.timestampMs,
              durationMs,
              steps: this.steps,
              samples: this.samples
            }
          }
        : { type: 'rejected', reason: 'too-fast', durationMs }

    // The body is back at the starting phase, so the next repetition starts right here.
    this.begin(last)
    return event
  }
}
