import type { Landmark } from '@renderer/core/landmarks'
import type { ObjectBox } from '@renderer/core/objectFrame'
import { SideTracker, type Side } from '@renderer/core/side'
import { LandmarkSmoother } from '@renderer/core/smoothing'
import { FeedbackPrioritizer, type FeedbackMessage } from './feedback'
import { computeMetrics, type FrameSize, type MetricValues } from './metrics'
import { RepCounter, type CompletedRep, type RepEvent } from './repCounter'
import { RepEvaluator, type RepResult } from './repEvaluator'
import { skillChannels } from '@shared/skill/skillChannels'
import type { AudioFeatures } from '@renderer/core/audio/capture'
import { AudioTracker } from './audioTracker'
import type { SkillConfig } from '@shared/skill/skillSchema'

export interface FrameInput {
  timestampMs: number
  // null when the model saw nobody.
  landmarks: readonly Landmark[] | null
  // The 21 points of the hand the skill is judged by; null when no hand is in view. Only skills that
  // look at hands read it.
  hand?: readonly Landmark[] | null
  // What the microphone heard in this frame (numbers only); null when it is not listening. Only
  // skills that listen read it.
  audio?: AudioFeatures | null
  // The box around the object, smoothed; null when it is not in view. Only skills that look at an
  // object read it.
  object?: ObjectBox | null
}

export interface FrameOutput {
  // False when what the skill needs to see (the body, a hand, an object, or several) could not be
  // followed in this frame.
  tracked: boolean
  // The side of the body being judged; null if the body is not used or could not be followed.
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
  tracked: false,
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
  private readonly handSmoother = new LandmarkSmoother()
  private readonly needsBody: boolean
  private readonly needsHand: boolean
  private readonly needsAudio: boolean
  private readonly needsObject: boolean
  private readonly audioTracker = new AudioTracker()
  private readonly sideTracker = new SideTracker()
  private readonly counter: RepCounter
  private readonly evaluator: RepEvaluator
  private readonly feedback = new FeedbackPrioritizer()
  private readonly results: RepResult[] = []
  private lostSinceMs: number | undefined
  private lastRep: CompletedRep | null = null

  constructor(
    private readonly skill: SkillConfig,
    private readonly frame: FrameSize
  ) {
    const channels = skillChannels(skill)
    this.needsBody = channels.includes('body')
    this.needsHand = channels.includes('hands')
    this.needsAudio = channels.includes('audio')
    this.needsObject = channels.includes('object')
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

  // The frames of the last valid repetition, for the personal calibration.
  get lastCompletedRep(): CompletedRep | null {
    return this.lastRep
  }

  processFrame(input: FrameInput): FrameOutput {
    const smoothed =
      this.needsBody && input.landmarks
        ? this.smoother.smooth(input.landmarks, input.timestampMs)
        : null
    const side = this.needsBody ? this.sideTracker.update(smoothed) : null
    const hand =
      this.needsHand && input.hand && input.hand.length > 0
        ? this.handSmoother.smooth(input.hand, input.timestampMs)
        : null
    if (this.needsHand && !hand) this.handSmoother.reset()

    const audio =
      this.needsAudio && input.audio
        ? this.audioTracker.update(input.timestampMs, input.audio)
        : null

    const bodyOk = !this.needsBody || (smoothed !== null && side !== null)
    const handOk = !this.needsHand || hand !== null
    const audioOk = !this.needsAudio || audio !== null
    const object = this.needsObject ? (input.object ?? null) : null
    const objectOk = !this.needsObject || object !== null
    if (!bodyOk || !handOk || !audioOk || !objectOk) {
      this.onBodyLost(input.timestampMs)
      return NOTHING
    }
    this.lostSinceMs = undefined

    const metrics = computeMetrics(
      this.skill.metrics,
      smoothed,
      side,
      this.frame,
      hand,
      audio,
      this.skill.audio?.a4,
      object
    )
    const repEvent = this.counter.update(input.timestampMs, metrics)

    if (repEvent?.type !== 'completed') {
      return {
        tracked: true,
        side,
        metrics,
        phase: this.counter.phase,
        repEvent,
        repResult: null,
        feedback: null
      }
    }

    this.lastRep = repEvent.rep
    const repResult = this.evaluator.evaluate(repEvent.rep)
    this.results.push(repResult)
    const feedback = this.feedback.onRepResult(repResult, input.timestampMs)

    return {
      tracked: true,
      side,
      metrics,
      phase: this.counter.phase,
      repEvent,
      repResult,
      feedback
    }
  }

  // Drops the repetition in progress, for example after a pause. Count and history are kept.
  restartTracking(): void {
    this.counter.reset()
    this.smoother.reset()
    this.handSmoother.reset()
    this.audioTracker.reset()
    this.sideTracker.reset()
    this.lostSinceMs = undefined
  }

  // Forgets the repetition in progress and the smoothing, but keeps the count and the history.
  private onBodyLost(timestampMs: number): void {
    this.lostSinceMs ??= timestampMs

    if (timestampMs - this.lostSinceMs >= LOST_BODY_RESET_MS) this.restartTracking()
  }
}
