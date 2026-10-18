import type { FeedbackMessage } from './feedback'
import type { FrameSize } from './metrics'
import type { CompletedRep } from './repCounter'
import type { RepQuality, RepResult } from './repEvaluator'
import { SkillSession, type FrameInput } from './skillSession'
import type { SkillConfig } from '@shared/skill/skillSchema'

export interface TrainingSnapshot {
  repCount: number
  phase: string | null
  // How the last finished repetition went; null before the first one.
  lastQuality: RepQuality | null
  // 'lost' once the body has been out of sight for a while, so the screen can say so.
  tracking: 'tracking' | 'lost'
  // A message to show now; null in most frames.
  feedback: FeedbackMessage | null
}

// How long the body may be out of sight before the user is told.
const LOST_AFTER_MS = 1500

// One training session as the training screen lives it: the engine plus "I can't see you",
// with the verdict of every repetition collected for the summary.
export class TrainingRun {
  private readonly session: SkillSession
  private lostSinceMs: number | undefined
  private snapshot: TrainingSnapshot = {
    repCount: 0,
    phase: null,
    lastQuality: null,
    tracking: 'tracking',
    feedback: null
  }

  constructor(skill: SkillConfig, frame: FrameSize) {
    this.session = new SkillSession(skill, frame)
  }

  get results(): readonly RepResult[] {
    return this.session.repResults
  }

  get lastRep(): CompletedRep | null {
    return this.session.lastCompletedRep
  }

  processFrame(input: FrameInput): TrainingSnapshot {
    const output = this.session.processFrame(input)
    const tracking = this.trackingAt(output.tracked, input.timestampMs)
    const lastQuality = output.repResult?.quality ?? this.snapshot.lastQuality

    this.snapshot = {
      repCount: this.session.repCount,
      phase: output.tracked ? output.phase : null,
      lastQuality,
      tracking,
      feedback: output.feedback
    }
    return this.snapshot
  }

  private trackingAt(bodyInView: boolean, timestampMs: number): TrainingSnapshot['tracking'] {
    if (bodyInView) {
      this.lostSinceMs = undefined
      return 'tracking'
    }
    this.lostSinceMs ??= timestampMs
    return timestampMs - this.lostSinceMs >= LOST_AFTER_MS ? 'lost' : 'tracking'
  }
}
