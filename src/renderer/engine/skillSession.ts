import type { Landmark } from '@renderer/core/landmarks'
import { SideTracker, type Side } from '@renderer/core/side'
import { LandmarkSmoother } from '@renderer/core/smoothing'
import { FeedbackPrioritizer, type FeedbackMessage } from './feedback'
import { computeMetrics, type FrameSize, type MetricValues } from './metrics'
import { RepCounter, type RepEvent } from './repCounter'
import { RepEvaluator, type RepResult } from './repEvaluator'
import type { SkillConfig } from '@shared/skill/skillSchema'

export interface FrameInput {
  timestampMs: number
  // null when the model saw nobody.
  landmarks: readonly Landmark[] | null
}

export interface FrameOutput {
  // The side of the body being judged, or null if the body could not be followed in this frame.
  side: Side | null
  metrics: MetricValues | null
  // The phase of the body now, such as "down"; null before the first phase is reached.
  phase: string | null
  repEvent: RepEvent | null
  // Set in the frame where a repetition is completed.
  repResult: RepResult | null
  // What to tell the user right now, if anything.
  feedback: FeedbackMessage | null
}

// If the body cannot be followed for longer than this, the repetition in progress is dropped.
const LOST_BODY_RESET_MS = 1000

const NOTHING: FrameOutput = {
  side: null,
  metrics: null,
  phase: null,
  repEvent: null,
  repResult: null,
  feedback: null
}

// The whole engine for one skill, from the landmarks of a frame to the feedback for the user:
// visible side → smoothing → metrics → phases and repetitions → rules → feedback.
// The training screen and the replay harness feed it the same way, one frame at a time.
export class SkillSession {
  private readonly smoother = new LandmarkSmoother()
  private readonly sideTracker = new SideTracker()
  private readonly counter: RepCounter
  private readonly evaluator: RepEvaluator
  private readonly feedback = new FeedbackPrioritizer()
  private readonly results: RepResult[] = []
  private lostSinceMs: number | undefined

  constructor(
    private readonly skill: SkillConfig,
    private readonly frame: FrameSize
  ) {
    this.counter = new RepCounter(skill)
    this.evaluator = new RepEvaluator(skill)
  }

  // Valid repetitions so far.
  get repCount(): number {
    return this.counter.count
  }

  // The verdict of every repetition so far, in order.
  get repResults(): readonly RepResult[] {
    return this.results
  }

  processFrame(input: FrameInput): FrameOutput {
    const smoothed = input.landmarks
      ? this.smoother.smooth(input.landmarks, input.timestampMs)
      : null
    const side = this.sideTracker.update(smoothed)

    if (!smoothed || !side) {
      this.onBodyLost(input.timestampMs)
      return NOTHING
    }
    this.lostSinceMs = undefined

    const metrics = computeMetrics(this.skill.metrics, smoothed, side, this.frame)
    const repEvent = this.counter.update(input.timestampMs, metrics)

    if (repEvent?.type !== 'completed') {
      return { side, metrics, phase: this.counter.phase, repEvent, repResult: null, feedback: null }
    }

    const repResult = this.evaluator.evaluate(repEvent.rep)
    this.results.push(repResult)
    const feedback = this.feedback.onRepResult(repResult, input.timestampMs)

    return { side, metrics, phase: this.counter.phase, repEvent, repResult, feedback }
  }

  // Drops the repetition in progress, for example after a pause. Count and history are kept.
  restartTracking(): void {
    this.counter.reset()
    this.smoother.reset()
    this.sideTracker.reset()
    this.lostSinceMs = undefined
  }

  // Forgets the repetition in progress and the smoothing, but keeps the count and the history.
  private onBodyLost(timestampMs: number): void {
    this.lostSinceMs ??= timestampMs

    if (timestampMs - this.lostSinceMs >= LOST_BODY_RESET_MS) this.restartTracking()
  }
}
