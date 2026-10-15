import { landmarksOf, type LandmarkRecording } from '@renderer/core/recording'
import type { FeedbackMessage } from './feedback'
import type { RepResult } from './repEvaluator'
import { SkillSession } from './skillSession'
import type { SkillConfig } from './skillSchema'

export interface ReplaySummary {
  frames: number
  // Frames in which the body could be followed.
  framesTracked: number
  repCount: number
  // Sequences that were completed too fast to count.
  rejectedReps: number
  results: readonly RepResult[]
  // Everything the user would have been told, with the moment it happened.
  feedback: Array<{ atMs: number; message: FeedbackMessage }>
}

// Plays a recorded movement through the whole engine and says what came out. It is how the
// thresholds of a skill are checked and tuned against real recordings, without a camera.
export function replayRecording(skill: SkillConfig, recording: LandmarkRecording): ReplaySummary {
  const session = new SkillSession(skill, recording.frameSize)
  const feedback: ReplaySummary['feedback'] = []
  let framesTracked = 0
  let rejectedReps = 0

  for (const frame of recording.frames) {
    const output = session.processFrame({ timestampMs: frame.t, landmarks: landmarksOf(frame) })

    if (output.side) framesTracked++
    if (output.repEvent?.type === 'rejected') rejectedReps++
    if (output.feedback) feedback.push({ atMs: frame.t, message: output.feedback })
  }

  return {
    frames: recording.frames.length,
    framesTracked,
    repCount: session.repCount,
    rejectedReps,
    results: session.repResults,
    feedback
  }
}
